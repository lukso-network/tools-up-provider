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

const minAmount = 0.25
const maxAmount = 1000

const DonateWidget = () => {
  const [chainId, setChainId] = useState<number>(0)
  const [accounts, setAccounts] = useState<Array<`0x${string}`>>([])
  const [walletConnected, setWalletConnected] = useState(false)
  const [amount, setAmount] = useState<number>(minAmount)
  const [error, setError] = useState('')

  const validateAmount = useCallback((value: number) => {
    if (value < minAmount) {
      setError(`Amount must be at least ${minAmount} LYX.`)
    } else if (value > maxAmount) {
      setError(`Amount cannot exceed ${maxAmount} LYX.`)
    } else {
      setError('')
    }
    setAmount(value)
  }, [])

  useEffect(() => {
    validateAmount(amount)
  }, [amount, validateAmount])

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
      await web3.eth.sendTransaction(
        {
          from: accounts[0],
          to: accounts[1],
          value: Web3.utils.toWei(amount.toString(), 'ether'),
        },
        undefined,
        { checkRevertBeforeSending: false }
      )
    }
  }

  return (
    <div className="donate-widget">
      <h3>
        Donate LYX
        <br />
        {accounts[1] !== '0x' ? accounts[1] : 'not connected'}
      </h3>
      <div>
        <label htmlFor="amount">Enter Amount:</label>
        <input
          id="amount"
          type="number"
          value={amount}
          onChange={e => {
            const value = Number.parseFloat(e.target.value)
            validateAmount(value)
          }}
          min={minAmount}
          max={maxAmount}
          step="1"
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
      <button type="button" onClick={donate} disabled={!walletConnected || !amount}>
        Donate {amount} LYX
      </button>
    </div>
  )
}

export default DonateWidget
