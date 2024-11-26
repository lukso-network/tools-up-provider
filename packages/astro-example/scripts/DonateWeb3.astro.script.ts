import { createClientUPProvider } from '@lukso/up-provider'
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
    walletConnected = accounts.length > 1 && chainId === 42
    const button: HTMLButtonElement = document.getElementById('donateButton') as HTMLButtonElement
    button.disabled = !walletConnected
  }

  // Fetch and set up account and chain information
  async function setupWeb3() {
    try {
      chainId = Number(await web3.eth.getChainId())
      accounts = (await web3.eth.getAccounts()) as Array<`0x${string}`>
      checkWalletStatus()
    } catch (error) {
      console.error('Error fetching Web3 info:', error)
    }
  }

  // Set up event listeners for account and chain changes
  provider.on('accountsChanged', _accounts => {
    accounts = _accounts
    checkWalletStatus()
  })

  provider.on('chainChanged', _chainId => {
    chainId = _chainId
    checkWalletStatus()
  })

  setupWeb3()

  // Donation function
  async function donate() {
    try {
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: accounts[1],
        value: web3.utils.toWei(amount.toString(), 'ether'),
      })
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

document.getElementById('selectId').addEventListener('change', event => {
  const { value } = event.target as HTMLSelectElement
  setAmount(Number(value))
  document.getElementById('donateButton').innerText = `Donate ${value} LYX`
})

document.getElementById('donateButton').addEventListener('click', donate)
