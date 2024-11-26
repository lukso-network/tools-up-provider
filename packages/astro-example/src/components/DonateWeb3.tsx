import { createClientUPProvider } from '@lukso/up-provider'
import { useCallback, useEffect, useState } from 'react'
import Web3, { type EthExecutionAPI, type SupportedProviders, type DataFormat, FMT_NUMBER, FMT_BYTES } from 'web3'
import './Donate.scss'

const provider = createClientUPProvider()
const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>)
const dataType: DataFormat = {
  number: FMT_NUMBER.NUMBER,
  bytes: FMT_BYTES.HEX,
}

const DonateWidget = () => {
  const [chainId, setChainId] = useState<number>(0)
  const [accounts, setAccounts] = useState<Array<`0x${string}`>>([])
  const [walletConnected, setWalletConnected] = useState(false)
  const [amount, setAmount] = useState<number>(0.01)
  const presetAmounts = [0.01, 0.05, 0.1]

  const updateConnected = useCallback((accounts: Array<`0x${string}`>, chainId: number) => {
    console.log(accounts, chainId)
    setWalletConnected(accounts.length > 0 && accounts[0] !== '0x' && chainId === 42)
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const _chainId: number = (await web3.eth.getChainId(dataType)) as number
        setChainId(_chainId)

        const _accounts = (await web3.eth.getAccounts()) as Array<`0x${string}`>
        setAccounts(_accounts)

        updateConnected(_accounts, _chainId)
      } catch (error) {
        // Ignore error
      }
    }

    init()

    const accountsChanged = (_accounts: Array<`0x${string}`>) => {
      setAccounts(_accounts)
      updateConnected(_accounts, chainId)
    }

    const chainChanged = (_chainId: number) => {
      setChainId(_chainId)
      updateConnected(accounts, _chainId)
    }

    provider.on('accountsChanged', accountsChanged)
    provider.on('chainChanged', chainChanged)

    return () => {
      provider.removeListener('accountsChanged', accountsChanged)
      provider.removeListener('chainChanged', chainChanged)
    }
  }, [chainId, accounts[0], accounts[1], updateConnected])

  const donate = async () => {
    if (walletConnected && amount) {
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: accounts[1],
        value: Web3.utils.toWei(amount.toString(), 'ether'),
      })
    }
  }

  return (
    <div className="donate-widget">
      <h3>Donate LYX</h3>
      <div>
        <label htmlFor="selectId">Select Amount:</label>
        <select id="selectId" value={amount} onChange={e => setAmount(Number(e.target.value))}>
          {presetAmounts.map(amt => (
            <option key={amt} value={amt}>
              {amt} LYX
            </option>
          ))}
        </select>
      </div>
      <button type="button" onClick={donate} disabled={!walletConnected || !amount}>
        Donate {amount} LYX
      </button>
    </div>
  )
}

export default DonateWidget
