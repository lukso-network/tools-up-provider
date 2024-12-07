<script setup lang="ts">
import { createClientUPProvider } from '@lukso/up-provider'
import { ref, watch } from 'vue'
import Web3, { type SupportedProviders, utils, type EthExecutionAPI } from 'web3'
import './Donate.scss'

const chainId = ref<number | null>(null)
const accounts = ref<string[]>(['0x0', '0x0'])
const walletConnected = ref<boolean>(false)

// Allocate the client up provider.
const provider = createClientUPProvider()
const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>)
// Initially retrieve chainId and accounts
web3.eth
  ?.getChainId()
  .then(_chainId => {
    chainId.value = Number(_chainId)
    walletConnected.value = !isEmptyAccount(accounts.value[0]) && !isEmptyAccount(accounts.value[1]) && chainId.value === 42
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
// Monitor accountsChanged and chainChained events
// This is how a grid widget gets it's accounts and chainId.
// Don't call eth_requestAccounts() directly to connect,
// The connection will be injected by the grid parent page.
provider.on('accountsChanged', (_accounts: `0x${string}`[]) => {
  accounts.value = _accounts
})
provider.on('chainChanged', (_chainId: number) => {
  chainId.value = _chainId
})

const isEmptyAccount = (value: string) => !value

// Watch all changes and compose a walletConnected boolean flag.
// Empty accounts (or disconnected) are represented by '0x0*' or undefined.
// Inside of the universaleverything.io grid, accounts[1] is always the page owner.
// The accounts[0] is either '0x0*' or the connected user.
watch(
  () => [chainId.value, accounts.value] as [number, Array<`0x${string}`>],
  ([chainId, accounts]: [number, Array<`0x${string}`>]) => {
    // Optionally you can do additional checks here.
    // For example if you check for accounts?.[0] !== accounts?.[1] you can
    // ensure that the connected account is not the page owner.
    // The button will be disabled if the walletConnected flag is false.
    walletConnected.value = !isEmptyAccount(accounts?.[0]) && !isEmptyAccount(accounts?.[1]) && chainId === 42
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
      to: accounts.value[1],
      value: utils.toWei(amount.value, 'ether'),
    },
    undefined,
    { checkRevertBeforeSending: false }
  )
}
</script>

<template>
  <div class="donate-widget">
    <h3>Donate LYX to<br />{{ !isEmptyAccount(accounts[1]) ? accounts[1] : 'not connected' }}</h3>
    <div>
      <label for="amount">Enter Amount:</label>
      <input id="amount" type="number" v-model.number="amount" :min="minAmount" :max="maxAmount" step="1" @input="validateAmount" />
      <p v-if="error" style="color: red">{{ error }}</p>
    </div>
    <button :disabled="!walletConnected || !amount" @click="donate">Donate {{ amount }} LYX</button>
  </div>
</template>
