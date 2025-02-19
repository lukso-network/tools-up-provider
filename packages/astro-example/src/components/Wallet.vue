<script setup lang="ts">
// WIP
import { createClientUPProvider } from '@lukso/up-provider'
import { ref, watch } from 'vue'
import Web3, { type SupportedProviders, type EthExecutionAPI, utils } from 'web3'
import './Donate.scss'

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
// Monitor accountsChanged and chainChained events
// This is how a grid widget gets it's accounts and chainId.
// Don't call eth_requestAccounts() directly to connect,
// The connection will be injected by the grid parent page.
provider.on('accountsChanged', (_accounts: `0x${string}`[]) => {
  accounts.value = [..._accounts]
})
provider.on('contextAccountsChanged', (_accounts: `0x${string}`[]) => {
  contextAccounts.value = [..._accounts]
})
provider.on('chainChanged', (_chainId: number) => {
  chainId.value = _chainId
})

// Watch all changes and compose a walletConnected boolean flag.
// Empty accounts (or disconnected) are represented by '0x0*' or undefined.
// Inside of the universaleverything.io grid, accounts[1] is always the page owner.
// The accounts[0] is either '0x0*' or the connected user.
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
async function donate() {
  web3.eth.sendTransaction(
    {
      from: accounts.value[0],
      to: contextAccounts.value[0],
      value: utils.toWei(amount.value, 'ether'),
    },
    undefined,
    { checkRevertBeforeSending: false }
  )
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
