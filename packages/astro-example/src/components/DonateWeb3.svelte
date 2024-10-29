<script lang="ts">
  import { onMount } from "svelte";
  import { createClientUPProvider } from '@lukso/up-provider';
  import Web3,{ type SupportedProviders, type EthExecutionAPI } from 'web3';

  let chainId: number | null = null;
  let accounts: string[] = [];
  let walletConnected = false;
  const presetAmounts = [0.01, 0.05, 0.1];
  // biome-ignore lint/style/useConst: <explanation>
  let amount = presetAmounts[0];

  const provider = createClientUPProvider();
  const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>);

  function checkWalletStatus() {
    walletConnected = !!accounts[0] && !!accounts[1] && chainId === 42;
  }

  onMount(() => {
    web3.eth.getChainId()
      .then((_chainId: bigint) => {
        chainId = Number(_chainId);
        checkWalletStatus();
      })
      .catch(error => { /* Ignore error */ });

    web3.eth.getAccounts()
      .then(_accounts => {
        accounts = _accounts || [];
        checkWalletStatus();
      })
      .catch(error => { /* Ignore error */ });

    provider.on('accountsChanged', (_accounts) => {
      accounts = _accounts;
      checkWalletStatus();
    });

    provider.on('chainChanged', (_chainId) => {
      chainId = _chainId;
      checkWalletStatus();
    });
  });

  function donate() {
    web3.eth.sendTransaction({
      from: accounts[0],
      to: accounts[1],
      value: web3.utils.toWei(amount, "ether")
    });
  }
</script>

<div class="donate-widget">
  <h3>Donate LYX</h3>
  <div>
    <label for="selectId">Select Amount:</label>
    <select id="selectId" bind:value={amount}>
      {#each presetAmounts as amt}
        <option value={amt}>{amt} LYX</option>
      {/each}
    </select>
  </div>
  <button on:click={donate} disabled={!walletConnected || !amount}>
    Donate {amount} LYX
  </button>
</div>

<style>
  .donate-widget {
  border: 2px solid #d1d1d1; /* Light border */
  border-radius: 12px; /* Rounded corners */
  padding: 20px; /* Inner padding */
  margin: 20px auto; /* Centered with margin */
  max-width: 300px; /* Constrain width */
  background-color: #f9f9f9; /* Light background */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* Soft shadow */
  text-align: center; /* Center text */
}

.donate-widget h3 {
  margin-top: 0; /* Remove extra space above heading */
  color: #333; /* Darker text for contrast */
}

.donate-widget label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.donate-widget select {
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #d1d1d1;
  margin-bottom: 15px;
}

.donate-widget button {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  background-color: #4caf50; /* Green background */
  color: white;
  font-weight: bold;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.donate-widget button:hover {
  background-color: #45a049; /* Darker green on hover */
}

.donate-widget button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>