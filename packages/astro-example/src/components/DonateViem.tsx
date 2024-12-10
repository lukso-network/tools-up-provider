import { createClientUPProvider, isEmptyAccount } from '@lukso/up-provider'
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
    setWalletConnected(accounts.length > 0 && !isEmptyAccount(accounts[0]) && !isEmptyAccount(accounts[1]) && chainId === 42)
  }, [])

  // Monitor accountsChanged and chainChained events
  // This is how a grid widget gets it's accounts and chainId.
  // Don't call eth_requestAccounts() directly to connect,
  // The connection will be injected by the grid parent page.
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

      setWalletConnected(accounts.length > 0 && !isEmptyAccount(accounts[0]) && !isEmptyAccount(accounts[1]) && _chainId === 42)
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
      <h3>
        Donate LYX
        <br />
        {!isEmptyAccount(accounts[1]) ? accounts[1] : 'not connected'}
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
