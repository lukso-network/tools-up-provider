import { createClientUPProvider, isEmptyAccount } from '@lukso/up-provider'
import Web3, { type EthExecutionAPI, type SupportedProviders } from 'web3'

let amount = 0.01
let chainId = 0
let accounts: Array<`0x${string}`> = []
let walletConnected = false

// Function to initialize provider and Web3 on the client side
function initWidget() {
  const provider = createClientUPProvider()
  const web3 = new Web3(provider as SupportedProviders<EthExecutionAPI>)

  // Update wallet connection status
  function checkWalletStatus() {
    walletConnected = accounts.length > 1 && !isEmptyAccount(accounts[0]) && !isEmptyAccount(accounts[1]) && chainId === 42
    const button: HTMLButtonElement = document.getElementById('donateButton') as HTMLButtonElement
    button.disabled = !walletConnected
    const accountNumber = document.getElementById('accountNumber')
    if (accountNumber) {
      accountNumber.innerText = walletConnected ? accounts[0] : 'Not connected'
    }
  }

  // Fetch and set up account and chain information
  async function setupWeb3() {
    try {
      chainId = Number(await web3.eth.getChainId())
      accounts = (await web3.eth.getAccounts()) as Array<`0x${string}`>
    } catch (error) {
      console.error('Error fetching Web3 info:', error)
    }
    checkWalletStatus()
  }

  // Monitor accountsChanged and chainChained events
  // This is how a grid widget gets it's accounts and chainId.
  // Don't call eth_requestAccounts() directly to connect,
  // The connection will be injected by the grid parent page.
  provider.on('accountsChanged', (_accounts: `0x${string}`[]) => {
    accounts = _accounts
    checkWalletStatus()
  })
  provider.on('chainChanged', (_chainId: any) => {
    chainId = _chainId
    checkWalletStatus()
  })

  setupWeb3()

  // Donation function
  async function donate() {
    try {
      await web3.eth.sendTransaction(
        {
          from: accounts[0],
          to: accounts[1],
          value: web3.utils.toWei(amount.toString(), 'ether'),
        },
        undefined,
        { checkRevertBeforeSending: false }
      )
    } catch (error) {
      console.error('Donation failed:', error)
    }
  }

  return {
    donate,
    setAmount: (newAmount: number) => {
      amount = newAmount
    },
  }
}
// Client-side script to handle interactions
const { donate, setAmount } = initWidget()

// Validation limits
const minAmount = 0.25 // Minimum allowed value
const maxAmount = 1000 // Maximum allowed value

const handleInput = (event: Event) => {
  const { value } = event.target as HTMLInputElement
  const numericValue = Number(value)
  const donateButton = document.getElementById('donateButton') as HTMLButtonElement
  const errorMessage = document.getElementById('errorMessage') as HTMLButtonElement

  if (numericValue < minAmount) {
    errorMessage.innerText = `Amount must be at least ${minAmount} LYX.`
    donateButton.disabled = true
  } else if (numericValue > maxAmount) {
    errorMessage.innerText = `Amount cannot exceed ${maxAmount} LYX.`
    donateButton.disabled = true
  } else {
    errorMessage.innerText = '' // Clear error message
    donateButton.disabled = !walletConnected
    donateButton.innerText = `Donate ${numericValue.toFixed(2)} LYX`
  }
}
const inputField = document.getElementById('inputId') as HTMLInputElement
inputField?.addEventListener('input', handleInput)

handleInput({ target: inputField } as unknown as Event)

document.getElementById('donateButton')?.addEventListener('click', donate)
