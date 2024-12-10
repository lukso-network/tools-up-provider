import { createClientUPProvider } from '@lukso/up-provider'
import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { createWalletClient, custom, parseUnits } from 'viem'
import { lukso } from 'viem/chains'

const provider = createClientUPProvider()
const client = createWalletClient({
  chain: lukso,
  transport: custom(provider),
})

@customElement('donate-widget')
class DonateWidget extends LitElement {
  static styles = css`
    :host {
      width: 100%;
      height: 100%;
    }

    .widget {
      display: flex; /* Enable flexbox for the widget content */
      flex-direction: column; /* Match parent direction if necessary */
      height: 100%; /* Take up full height of :host */
      width: 100%; /* Take up full width of :host */
    }

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
  `

  @property({ type: Number }) minAmount = 0.25
  @property({ type: Number }) maxAmount = 1000
  @property({ type: Number }) defaultAmount = this.minAmount
  @state() chainId = 0
  @state() accounts: Array<`0x${string}`> = []
  @state() contextAccounts: Array<`0x${string}`> = []
  @state() walletConnected = false
  @state() error = '' // Error message for validation feedback
  @state() amount = this.defaultAmount
  @state() presetAmounts = [0.01, 0.05, 0.1]
  @state() disabled = true

  // Watch for changes in propA and propB
  updated(changedProperties: Map<PropertyKey, unknown>) {
    if (changedProperties.has('walletConnected') || changedProperties.has('amount') || changedProperties.has('accounts') || changedProperties.has('contextAccounts') || changedProperties.has('chainId')) {
      this.calculateEnabled()
    }
  }

  calculateEnabled() {
    this.disabled = !this.amount || this.accounts.length === 0 || this.contextAccounts.length === 0 || this.chainId !== 42
    console.log({ amount: this.amount, accounts: this.accounts, contextAccounts: this.contextAccounts, chainId: this.chainChanged, disabled: this.disabled })
  }

  validateAmount() {
    if (this.amount < this.minAmount) {
      this.error = `Amount must be at least ${this.minAmount} LYX.`
    } else if (this.amount > this.maxAmount) {
      this.error = `Amount cannot exceed ${this.maxAmount} LYX.`
    } else {
      this.error = '' // Clear error if valid
    }
  }

  handleInput(e: InputEvent) {
    this.amount = Number.parseFloat((e.target as HTMLInputElement)?.value)
    this.validateAmount()
  }

  constructor() {
    super()
    this.init()
  }

  async init() {
    try {
      client.getChainId().then(chainId => {
        this.chainId = chainId
      })
      client.getAddresses().then(addresses => {
        this.accounts = addresses
      })
      this.contextAccounts = provider.contextAccounts
      this.walletConnected = this.accounts.length > 0 && this.contextAccounts.length > 0 && this.chainId === 42
    } catch (error) {
      console.error(error)
      // Ignore error
    }

    provider.on('accountsChanged', this.accountsChanged.bind(this))
    provider.on('chainChanged', this.chainChanged.bind(this))
    provider.on('contextAccountsChanged', this.contextAccountsChanged.bind(this))
  }

  accountsChanged(_accounts: Array<`0x${string}`>) {
    this.accounts = [..._accounts]
    this.walletConnected = this.accounts.length > 0 && this.contextAccounts.length > 0 && this.chainId === 42
  }

  chainChanged(_chainId: number) {
    this.chainId = _chainId
    this.walletConnected = this.accounts.length > 0 && this.contextAccounts.length > 0 && this.chainId === 42
  }

  contextAccountsChanged(_accounts: Array<`0x${string}`>) {
    this.contextAccounts = [..._accounts]
    this.walletConnected = this.accounts.length > 0 && this.contextAccounts.length > 0 && this.chainId === 42
  }

  async donate() {
    if (this.walletConnected && this.amount) {
      await client.sendTransaction({
        account: this.accounts[0] as `0x${string}`,
        to: this.accounts[1] as `0x${string}`,
        value: parseUnits(this.amount.toString(), 18),
      })
    }
  }

  render() {
    return html`
      <div class="widget">
        <div class="donate-widget">
          <h3>Donate LYX LIT<br /><small>${this.contextAccounts.length > 0 ? this.contextAccounts[0] : 'not connected'}</small></h3>
          <div>
            <label for="amount">Enter Amount:</label>
            <input id="amount" type="number" .value="${this.amount}" @input="${this.handleInput}" min="${this.minAmount}" max="${this.maxAmount}" step="1" />
            ${this.error ? html`<p>${this.error}</p>` : ''}
          </div>
          <button type="button" ?disabled="${this.disabled}" @click="${this.donate}">Donate ${this.amount} LYX</button>
        </div>
      </div>
    `
  }
}

export default DonateWidget
