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
  `

  @property({ type: Number }) chainId = 0
  @property({ type: Array<`0x${string}` | ''> }) accounts: Array<`0x${string}` | ''> = []
  @property({ type: Boolean }) walletConnected = false
  @property({ type: Number }) amount = 0.01
  @state() presetAmounts = [0.01, 0.05, 0.1]
  @state() disabled = true

  // Watch for changes in propA and propB
  updated(changedProperties: Map<PropertyKey, unknown>) {
    if (changedProperties.has('amount') || changedProperties.has('accounts') || changedProperties.has('chainId')) {
      this.calculateEnabled()
    }
  }

  calculateEnabled() {
    this.disabled = !this.amount || !this.accounts[0] || !this.accounts[1] || this.accounts[0] === this.accounts[1] || this.chainId !== 42
    console.log({ amount: this.amount, accounts: this.accounts, chainId: this.chainChanged, disabled: this.disabled })
  }

  constructor() {
    super()
    this.init()
  }

  async init() {
    try {
      this.chainId = Number(await client.getChainId())
      this.accounts = (await client.getAddresses()) as Array<`0x${string}` | ''>
      this.walletConnected = this.accounts.length > 0 && this.chainId === 42
    } catch (error) {
      // Ignore error
    }

    provider.on('accountsChanged', this.accountsChanged.bind(this))
    provider.on('chainChanged', this.chainChanged.bind(this))
  }

  accountsChanged(_accounts: Array<`0x${string}` | ''>) {
    this.accounts = _accounts
    this.walletConnected = this.accounts.length > 0 && this.chainId === 42
  }

  chainChanged(_chainId: number) {
    this.chainId = _chainId
    this.walletConnected = this.accounts.length > 0 && this.chainId === 42
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
      <div class="donate-widget">
        <h3>Donate LYX LIT</h3>
        <div>
          <label for="selectId">Select Amount:</label>
          <select
            id="selectId"
            .value="${this.amount}"
            @change="${(e: Event) => {
              this.amount = Number((e.target as null | undefined | { value: string })?.value)
            }}"
          >
            ${this.presetAmounts.map(amt => html` <option value="${amt}">${amt} LYX</option> `)}
          </select>
        </div>
        <button type="button" ?disabled="${this.disabled}" @click="${this.donate}">Donate ${this.amount} LYX</button>
      </div>
    `
  }
}

export default DonateWidget
