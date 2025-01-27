# up-provider

The [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) compatible up-provider allows dApps to function as mini-apps in the context of a parent website, that supports the up-provider. This allows users of the parent applications to one-click-connect
to your mini-app.

This package also contains the [server connector for parent applications](#provider-server-for-parent-pages).

## Installation

```bash
npm install @lukso/up-provider
```

## Provider for mini-apps

Client side setup of the [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) up-provider

### Using with viem

```ts
import { createClientUPProvider } from '@lukso/up-provider'
import { createWalletClient, createPublicClient, custom } from 'viem'
import { lukso } from 'viem/chains'

// Construct the up-provider
const provider = createClientUPProvider()

// Create public client if you need direct connection to RPC
const publicClient = createPublicClient({
  chain: lukso,
  transport: http(),
})

// Create wallet client to connect to provider
const walletClient = createWalletClient({
  chain: lukso,
  transport: custom(provider),
})
```

### Using with web3.js

```ts
import { createClientUPProvider } from '@lukso/up-provider';
import Web3, { type EthExecutionAPI, type SupportedProviders } from 'web3';

// Create the up-provider
const provider = createClientUPProvider();

// Wrap provider into web3 for usage.
const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>);
```

### Using ethers.js

```ts
import { createClientUPProvider } from '@lukso/up-provider'
import { type Eip1193Provider, ethers } from 'ethers'

// Create the up-provider
const provider = createClientUPProvider()

// Wrap provider into ethers for usage.
const browserProvider = new ethers.BrowserProvider(upProvider as unknown as Eip1193Provider)
```

### Accounts and Chains

The up-provider gives your the chain and accounts that the parent page's supports.

#### Accounts

As the mini-app can NOT force `eth_requestAccounts`, you need to listen to the `accountsChanged` event
to see when a user of the parent app chose to connect to your mini-app. You can then call `eth_accounts` to get a list of accounts that can execute transactions.

```ts
provider.on('accountsChanged', (_accounts: `0x${string}`[]) => {
  // Update your interface to show that the user is connected and enable your transaction buttons
})

// Returns a list of allowed accounts
provider.allowedAccounts
//> ['0x1234...']
```

#### Context accounts

A parent page can also provide you with a context account. This are one or more accounts,
that are relevant for the context in which the mini-app was loaded.
On [universaleverything.io](http://universaleverything.io) this is the universal profile that has the mini-app in its grid,
while `account[0]` will be the visitor that connected to your mini-app.

```ts
// Event for context accounts change
provider.on('contextAccountsChanged', (contextAccountsArray: `0x${string}`[]) => {
  // Do something with the context contextAccountsArray[0]
})

// Returns a list of context accounts, thet the parent app wants to provide
provider.contextAccounts
//> ['0x1234...']
```

### Examples to monitor "accountsChanged", "contextAccountsChanged" and "chainChained"

You should use some kind of watch/useEffect or other reactive function to watch the
`accountsChanged`, `contextAccountsChanged` and `chainChanged'` events. You can initially call `eth_accounts`, `up_contextAccounts` (or provider.contextAccounts) and `eth_chainId` to initialize accounts and chainId.

### Example React code for events

The output is a boolean walletConnected which will be true/false.

```tsx
const [chainId, setChainId] = useState<number>(0)
const [accounts, setAccounts] = useState<Array<`0x${string}`>>([])
const [contextAccounts, setContextAccounts] = useState<Array<`0x${string}`>>([])
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

const updateConnected = useCallback((accounts: Array<`0x${string}`>, contextAccounts: Array<`0x${string}`>, chainId: number) => {
  console.log(accounts, chainId)
  setWalletConnected(accounts.length > 0 && contextAccounts.length > 0)
}, [])

// Monitor accountsChanged and chainChained events
// This is how a grid widget gets it's accounts and chainId.
// Don't call eth_requestAccounts() directly to connect,
// The connection will be injected by the grid parent page.
useEffect(() => {
  async function init() {
    try {
      const _chainId: number = (await web3.eth.getChainId(dataType)) as number
      setChainId(_chainId)

      const _accounts = (await web3.eth.getAccounts()) as Array<`0x${string}`>
      setAccounts(_accounts)

      const _contextAccounts = provider.contextAccounts

      updateConnected(_accounts, _contextAccounts, _chainId)
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
```

### Example Vue code for events

```ts
const chainId = ref<number | null>(null)
const accounts = ref<string[]>([])
const contextAccounts = ref<string[]>([])
const walletConnected = ref<boolean>(false)

// Allocate the client up provider.
const provider = createClientUPProvider()

const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>)

// Initially retrieve chainId and accounts
web3.eth
  ?.getChainId()
  .then(_chainId => {
    chainId.value = Number(_chainId)
    walletConnected.value = accounts.value.length > 0 && contextAccounts.value.length > 0
  })
  .catch(error => {
    // Ignore error
  })
web3.eth
  ?.getAccounts()
  .then(_accounts => {
    accounts.value = _accounts || []
  })
  .catch(error => {
    // Ignore error
  })
provider
  .request('up_contextAccounts', [])
  .then(_accounts => {
    contextAccounts.value = _accounts || []
  })
  .catch(error => {
    // Ignore error
  })

// Watch for changes in accounts
provider.on('accountsChanged', (_accounts: `0x${string}`[]) => {
  accounts.value = [..._accounts]
})

// Watch for changes in contextAccounts
provider.on('contextAccountsChanged', (_accounts: `0x${string}`[]) => {
  contextAccounts.value = [..._accounts]
})

// Watch for changes in chainId
provider.on('chainChanged', (_chainId: number) => {
  chainId.value = _chainId
})

watch(
  () => [chainId.value, accounts.value, contextAccounts.value] as [number, Array<`0x${string}`>, Array<`0x${string}`>],
  ([chainId, accounts, contextAccounts]: [number, Array<`0x${string}`>, Array<`0x${string}`>]) => {
    // Optionally you can do additional checks here.
    // For example if you check for accounts?.[0] !== accounts?.[1] you can
    // ensure that the connected account is not the page owner.
    // The button will be disabled if the walletConnected flag is false.
    walletConnected.value = accounts?.length > 0 && contextAccounts?.length > 0
  }
)
```

## Provider server for parent pages

The parent page side of the up-provider, is used in pages that host mini-apps and can pass up connections from iframes to a parent provider like `window.ethereum` (referred to as orignalProvider below)

```ts
import { UPClientChannel, createUPProviderConnector } from '@lukso/up-provider'

// Pass in the provider you want the page to use.
const providerConnector = createUPProviderConnector(originalProvider, ['https://rpc.mainnet.lukso.network'])
// or later on call
// globalProvider.setupProvider(originalProvider, ['https://rpc.mainnet.lukso.network'])

providerConnector.on('channelCreated', ({ channel, id }) => {
  // Called when an iframe connects.
  // then channel can control the connection.
  // Usually you would store this in a ref and use it within a dialog to control the connection.

  // for example
  channel.enabled = true;
  // The addresses and chainId it will cause addressChanged and chainChanged events on the client provider.
  channel.setAllowedAccounts([profileAddress, ...extraAddresses])
})

```

### Additonal parent page provider functions

```js
// These setting will override what's returned from the parent provider
providerConnector.setAllowedAccounts(addressArray)
providerConnector.setChainId(chainId)
providerConnector.setContextAccounts(addressArray)

// These settings will override values specifically for one connection
channel.setAllowedAccounts(addressArray)
channel.setChainId(chainId)
channel.setContextAccounts(addressArray)

// All setX functions can also be used as a writable property.
channel.enable = true
channel.accounts = addressArray
channel.chainId = 42
channel.contextAccounts = addressArray

// There is also a utility function called setupChannel which can supply
// all enable, accounts, contextAccounts and chainId at the same time
channel.setupChannel(enable, [profileAddress], [contextAddress], chainId)
```

## API Docs

[API Docs](https://lukso-network.github.io/tools-up-provider)

## Flow diagrams

[Diagrams](./docs/diagrams.md)
