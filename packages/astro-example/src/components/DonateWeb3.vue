<script setup lang="ts">
import { createClientUPProvider } from '@lukso/up-provider'
import { ref, watch } from 'vue'
import Web3, { type SupportedProviders, type EthExecutionAPI } from 'web3'
import './Donate.scss'

const chainId = ref<number | null>(null)
const accounts = ref<string[]>(['0x', '0x'])
const walletConnected = ref<boolean>(false)
const provider = createClientUPProvider()
const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>)
web3.eth
  ?.getChainId()
  .then(_chainId => {
    chainId.value = Number(_chainId)
    walletConnected.value = accounts.value[0] !== '0x' && accounts.value[1] !== '0x' && chainId.value === 42
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
provider.on('accountsChanged', (_accounts: `0x${string}`[]) => {
  accounts.value = _accounts
})
provider.on('chainChanged', (_chainId: number) => {
  chainId.value = _chainId
})
watch(
  () => [chainId.value, accounts.value] as [number, Array<`0x${string}`>],
  ([chainId, accounts]: [number, Array<`0x${string}`>]) => {
    walletConnected.value = !!accounts?.[0] && !!accounts?.[1] && chainId === 42
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
  web3.eth.sendTransaction({
    from: accounts.value[0],
    to: accounts.value[1],
    value: amount.value?.toString() || '0',
  })
}
</script>

<template>
  <div class="donate-widget">
    <h3>Donate LYX to<br />{{ accounts[1] !== '0x' ? accounts[1] : 'not connected' }}</h3>
    <div>
      <label for="amount">Enter Amount:</label>
      <input id="amount" type="number" v-model.number="amount" :min="minAmount" :max="maxAmount" step="1" @input="validateAmount" />
      <p v-if="error" style="color: red">{{ error }}</p>
    </div>
    <button :disabled="!walletConnected || !amount" @click="donate">Donate {{ amount }} ETH</button>
  </div>
</template>
