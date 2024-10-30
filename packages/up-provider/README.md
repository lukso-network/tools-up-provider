# @lukso/up-provider

Client and server connector for UPProvider.

## Grid Widget side of provider

Client side (for example inside of a grid widget) setup

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
  channel.allowAccounts(enable, [profileAddress, ...extraAddresses], chainId)
})

```

## API Docs

[API Docs](https://lukso-network.github.io/tools-up-provider)
