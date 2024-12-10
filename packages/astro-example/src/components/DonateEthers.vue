<script setup lang="ts">
import { createClientUPProvider } from '@lukso/up-provider'
import { type Eip1193Provider, ethers } from 'ethers'
import { ref, watch } from 'vue'
import './Donate.scss'

const chainId = ref<number | null>(null)
const accounts = ref<string[]>([])
const contextAccounts = ref<string[]>([])
const walletConnected = ref<boolean>(false)
const provider = createClientUPProvider()
const ethersProvider = new ethers.BrowserProvider(provider as unknown as Eip1193Provider)
ethersProvider
  .send('eth_chainId', [])
  .then(_chainId => {
    chainId.value = _chainId
    walletConnected.value = accounts.value.length > 0 && contextAccounts.value.length > 0 && chainId.value === 42
  })
  .catch(error => {
    // Ignore error
  })
ethersProvider.provider
  .send('eth_accounts', [])
  .then(_accounts => {
    accounts.value = _accounts || []
  })
  .catch(error => {
    // Ignore error
  })
ethersProvider.provider
  .send('up_contextAccounts', [])
  .then(_accounts => {
    contextAccounts.value = _accounts || []
  })
  .catch(error => {
    // Ignore error
  })
// Monitor accountsChanged and chainChained events
// This is how a grid widget gets it's accounts and chainId.
// Don't call eth_requestAccounts() directly to connect,
// The connection will be injected by the grid parent page.
provider.on('accountsChanged', (_accounts: `0x${string}`[]) => {
  accounts.value = _accounts
})
provider.on('contextAccountsChanged', (_accounts: `0x${string}`[]) => {
  contextAccounts.value = _accounts
})
provider.on('chainChanged', (_chainId: number) => {
  chainId.value = _chainId
})

const error = ref('') // Error message for validation feedback
const amount = ref(1)

// Validation limits
const minAmount = 0.25 // Minimum allowed value
const maxAmount = 1000 // Maximum allowed value

// Watch and validate input
const validateAmount = () => {
  if (amount.value < minAmount) {
    error.value = `Amount must be at least ${minAmount} LYX.`
  } else if (amount.value > maxAmount) {
    error.value = `Amount cannot exceed ${maxAmount} LYX.`
  } else {
    error.value = '' // Clear error if valid
  }
}

// Optionally validate immediately on load or updates
watch(amount, validateAmount)

// Watch all changes and compose a walletConnected boolean flag.
// Empty accounts (or disconnected) are represented by '0x0*' or undefined.
// Inside of the universaleverything.io grid, accounts[1] is always the page owner.
// The accounts[0] is either '0x0*' or the connected user.
watch(
  () => [chainId.value, accounts.value, contextAccounts.value] as [number, Array<`0x${string}`>, Array<`0x${string}`>],
  ([chainId, accounts, contextAccounts]: [number, Array<`0x${string}`>, Array<`0x${string}`>]) => {
    walletConnected.value = accounts.length > 0 && contextAccounts.length > 0 && chainId === 42
  }
)
function donate() {
  ethersProvider.send('eth_sendTransaction', {
    from: accounts.value[0],
    to: accounts.value[1],
    value: amount.value?.toString() || '0',
  })
}
</script>

<template>
  <div class="donate-widget">
    <h3>
      Donate LYX to<br /><small>{{ contextAccounts.length > 0 ? contextAccounts[0] : 'not connected' }}</small>
    </h3>
    <div>
      <label for="amount">Enter Amount:</label>
      <input id="amount" type="number" v-model.number="amount" :min="minAmount" :max="maxAmount" step="1" @input="validateAmount" />
      <p v-if="error" style="color: red">{{ error }}</p>
    </div>
    <button :disabled="!walletConnected || !amount" @click="donate">Donate {{ amount }} LYX</button>
  </div>
</template>
