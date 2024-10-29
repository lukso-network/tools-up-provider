<script setup lang="ts">
import { createClientUPProvider } from '@lukso/up-provider'
import { ref, watch } from 'vue'
import Web3, { type SupportedProviders, type EthExecutionAPI } from 'web3'
import './Donate.scss'

const chainId = ref<number | null>(null)
const accounts = ref<string[]>([])
const walletConnected = ref<boolean>(false)
const presetAmounts = [0.01, 0.05, 0.1]
const amount = ref<string>(presetAmounts[0].toString())
const provider = createClientUPProvider()
const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>)
web3.eth
  ?.getChainId()
  .then(_chainId => {
    chainId.value = Number(_chainId)
    walletConnected.value = !!accounts.value[0] && !!accounts.value[1] && chainId.value === 42
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
provider.on('accountsChanged', (_accounts: (`0x${string}` | '')[]) => {
  accounts.value = _accounts
})
provider.on('chainChanged', (_chainId: number) => {
  chainId.value = _chainId
})
watch(
  () => [chainId.value, accounts.value] as [number, Array<`0x${string}` | ''>],
  ([chainId, accounts]: [number, Array<`0x${string}` | ''>]) => {
    walletConnected.value = !!accounts?.[0] && !!accounts?.[1] && chainId === 42
  }
)
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
    <h3>Donate LYX</h3>
    <div>
      <label>Select Amount:</label>
      <select v-model="amount">
        <option v-for="amt in presetAmounts" :key="amt" :value="amt">{{ amt }} LYX</option>
      </select>
    </div>
    <button :disabled="!walletConnected || !amount" @click="donate">Donate {{ amount }} ETH</button>
  </div>
</template>
