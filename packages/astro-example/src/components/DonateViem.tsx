import { createClientUPProvider } from '@lukso/up-provider'
import { useCallback, useEffect, useState } from 'react'
import { createWalletClient, custom, parseUnits } from 'viem'
import { lukso } from 'viem/chains'
import './Donate.scss'

const provider = createClientUPProvider()
// const publicClient = createPublicClient({
//   chain: lukso,
//   transport: http(),
// })
const client = createWalletClient({
  chain: lukso,
  transport: custom(provider),
})

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
        const _chainId: number = (await client.getChainId()) as number
        setChainId(_chainId)

        const _accounts = (await client.getAddresses()) as Array<`0x${string}`>
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

      console.log(accounts, _chainId)

      setWalletConnected(accounts.length > 0 && !!accounts[0] && _chainId === 42)
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
      await client.sendTransaction({
        account: accounts[0] as `0x${string}`,
        to: accounts[1] as `0x${string}`,
        value: parseUnits(amount.toString(), 18),
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
