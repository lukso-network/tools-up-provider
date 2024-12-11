# @lukso/up-provider

Client and server connector for UPProvider.

## Grid Widget side of provider

Client side (for example inside of a grid widget) setup

### Using viem

```ts
import { createClientUPProvider } from '@lukso/up-provider'
import { createWalletClient, custom } from 'viem'
import { lukso } from 'viem/chains'

const provider = createClientUPProvider()
const publicClient = createPublicClient({
  chain: lukso,
  transport: http(),
})
const walletClient = createWalletClient({
  chain: lukso,
  transport: custom(provider),
})
```

### Using web3.js

```ts
import { createClientUPProvider } from '@lukso/up-provider';
import Web3, { type EthExecutionAPI, type SupportedProviders } from 'web3';
const provider = createClientUPProvider();
const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>);
```

### Using ethers.js

```ts
import { createClientUPProvider } from '@lukso/up-provider'
import { type Eip1193Provider, ethers } from 'ethers'
const provider = createClientUPProvider()
const browserProvider = new ethers.BrowserProvider(upProvider as unknown as Eip1193Provider)
```

### Finding Accounts and Chains

The grid widget up-provider mirrors the chain and accounts provided by the parent page's
provider and configuration. When the grid widget connects it can call eth_accounts
to get a list of accounts. By default the accounts[0] will represent the user's address
but will initially return '0x0*' meaning that the grid widget does not yet have permissions
to connect to the extension. Once the user clicks the connect button above the widget
a "accountsChanged" event will trigger to supply the user with the native connection
the page is connected to. accounts[1] will represent the address of the owner
of the grid displayed on screen. If the user is looking at their own grid it's probably
an indication to disabled some buttons. For example on a "Donation" type widget it's not
useful to send funds yto yourself.

Most of the time the condition for "it's ok to send transactions would be"

```js
const accountConnected = accounts.length > 0 && contextAccounts.length > 0 && chainId === 42;
```

You should use some kind of watch/useEffect or other reactive function to watch the
.on('accountsChanged') and .on('chainChanged') events. You can initially call eth_accounts and eth_chainId to initialize accounts and chainId.

### Example React code to monitor accountsChanged, contextAccountsChanged and chainChained

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
  setWalletConnected(accounts.length > 0 && contextAccounts.length > 0 && chainId === 42)
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

### Example Vue code to monitor accountsChanged and chainChanged

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
    walletConnected.value = accounts.value.length > 0 && contextAccounts.value.length > 0 && chainId.value === 42
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
    walletConnected.value = accounts?.length > 0 && contextAccounts?.length > 0 && chainId === 42
  }
)
```

## Page side of the provider

Server side (i.e. parent page of the iframe) setup

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

## Flow diagrams

[Diagrams](./docs/diagrams.md)

## API Docs

[API Docs](https://lukso-network.github.io/tools-up-provider)
