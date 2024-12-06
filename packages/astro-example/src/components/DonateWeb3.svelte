<script lang="ts">
  import { createClientUPProvider } from '@lukso/up-provider';
  import { onMount } from "svelte";
  import Web3,{ type SupportedProviders, type EthExecutionAPI } from 'web3';

  let chainId: number | null = null;
  let accounts: string[] = [];
  let walletConnected = false;
  const presetAmounts = [0.01, 0.05, 0.1];

  const provider = createClientUPProvider();
  const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>);

  function checkWalletStatus() {
    walletConnected = !!accounts[0] && !!accounts[1] && chainId === 42;
  }

  let error = ''; // Error message for validation feedback
  // biome-ignore lint/style/useConst: <explanation>
  let amount = 1; // Initial amount

  const minAmount = 0.25; // Minimum allowed value
  const maxAmount = 1000; // Maximum allowed value

  // Validation function
  const validateAmount = () => {
    if (amount < minAmount) {
      error = `Amount must be at least ${minAmount} LYX.`;
    } else if (amount > maxAmount) {
      error = `Amount cannot exceed ${maxAmount} LYX.`;
    } else {
      error = ''; // Clear error if valid
    }
  };

  onMount(() => {
    validateAmount();
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
    },
    undefined,
    { checkRevertBeforeSending: false });
  }
</script>

<div class="donate-widget">
  <h3>Donate LYX<br/>{ accounts[1] !== '0x' ? accounts[1] : 'not connected' }</h3>
  <div>
    <label for="amount">Enter Amount:</label>
    <input
      id="amount"
      type="number"
      bind:value={amount}
      min={minAmount}
      max={maxAmount}
      step="1"
      on:input={validateAmount}
    />
    {#if error}
      <p style="color: red;">{error}</p>
    {/if}
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
  background-color: #f9f9f9; /* Light background */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* Soft shadow */
  text-align: center; /* Center text */
  flex: 1; /* Fill available space */
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

.donate-widget input {
  width: calc(100% - 8px);
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