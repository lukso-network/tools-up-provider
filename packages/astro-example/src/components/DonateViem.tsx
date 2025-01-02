import { createClientUPProvider } from '@lukso/up-provider'
import { useCallback, useEffect, useState } from 'react'
import { createWalletClient, custom, parseUnits } from 'viem'
import { lukso, luksoTestnet } from 'viem/chains'
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
  const [contextAccounts, setContextAccounts] = useState<Array<`0x${string}`>>([])
  const [walletConnected, setWalletConnected] = useState(false)
  const [amount, setAmount] = useState<number>(1)
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

  const updateConnected = useCallback((_accounts: Array<`0x${string}`>, _contextAccounts: Array<`0x${string}`>, _chainId: number) => {
    console.log(_accounts, _contextAccounts, _chainId)
    setWalletConnected(_accounts.length > 0 && _contextAccounts.length > 0 && (_chainId === lukso.id || _chainId === luksoTestnet.id))
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

        const _contextAccounts = provider.contextAccounts
        updateConnected(_accounts, contextAccounts, _chainId)
      } catch (error) {
        // Ignore error
      }
    }

    init()

    const accountsChanged = (_accounts: Array<`0x${string}`>) => {
      setAccounts(_accounts)
      updateConnected(_accounts, contextAccounts, chainId)
    }

    const contextAccountsChanged = (_accounts: Array<`0x${string}`>) => {
      setContextAccounts(_accounts)
      updateConnected(accounts, _accounts, chainId)
    }

    const chainChanged = (_chainId: number) => {
      setChainId(_chainId)
      updateConnected(accounts, contextAccounts, _chainId)
    }

    provider.on('accountsChanged', accountsChanged)
    provider.on('chainChanged', chainChanged)
    provider.on('contextAccountsChanged', contextAccountsChanged)

    return () => {
      provider.removeListener('accountsChanged', accountsChanged)
      provider.removeListener('contextAccountsChanged', contextAccountsChanged)
      provider.removeListener('chainChanged', chainChanged)
    }
  }, [chainId, accounts[0], contextAccounts[0], updateConnected])

  const donate = async () => {
    if (walletConnected && amount) {
      await client.sendTransaction({
        account: accounts[0] as `0x${string}`,
        to: contextAccounts[0] as `0x${string}`,
        value: parseUnits(amount.toString(), 18),
        chain: chainId === lukso.id ? lukso : luksoTestnet,
        kzg: undefined,
      })
    }
  }

  return (
    <div className="donate-widget">
      <h3>
        Donate LYX to
        <br />
        <small>{contextAccounts.length > 0 ? contextAccounts[0] : 'not connected'}</small>
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
