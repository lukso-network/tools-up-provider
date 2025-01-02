import { LitElement, html, css, type PropertyDeclarations } from 'lit'

/**
 * Small lit component to work on popup.
 * This is not being called quite yet but will be the way to support
 * the popup in the future.
 */
export class ModalPopup extends LitElement {
  static styles = css`
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      justify-content: center;
      align-items: center;
    }
    .modal.show {
      display: flex;
    }
    .modal-content {
      background-color: #fff;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      /* Default size for larger screens */
      width: 480px;
      height: 640px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    /* Fullscreen iframe for mobile devices */
    @media (max-width: 768px) {
      .modal-content {
        width: 100%;
        height: 100%;
        border-radius: 0; /* Remove rounded corners on mobile */
      }
    }
    .close-button {
      position: absolute;
      top: 10px;
      right: 15px;
      font-size: 24px;
      cursor: pointer;
      z-index: 10;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  `

  static properties: PropertyDeclarations = {
    isOpen: { type: Boolean },
    iframeSrc: { type: String },
  }

  isOpen = false
  iframeSrc = ''

  private iframeElement: HTMLIFrameElement | null | undefined

  render() {
    return html`
      <div class="modal ${this.isOpen ? 'show' : ''}">
        <div class="modal-content">
          <span class="close-button" @click="${this.closeModal}">&times;</span>
          <iframe src="about:blank"></iframe>
        </div>
      </div>
    `
  }

  handleIframeLoad = () => {
    const { contentWindow } = (this.iframeElement || {}) as HTMLIFrameElement
    this.resolve?.(contentWindow)
  }

  handleIframeError = (e: ErrorEvent) => {
    this.reject?.(e.error)
    this.closeModal()
  }

  private resolve?: (window: Window | null) => void
  private reject?: (error: Error) => void

  async openModal(url: string): Promise<Window | null> {
    const defer = new Promise<Window | null>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    this.iframeSrc = url
    this.isOpen = true

    if (this.iframeElement) {
      this.iframeElement.src = url
    }
    return defer
  }

  firstUpdated() {
    this.iframeElement = this.renderRoot.querySelector('iframe') as HTMLIFrameElement
    if (this.iframeElement) {
      this.iframeElement.addEventListener('load', this.handleIframeLoad)
      this.iframeElement.addEventListener('error', this.handleIframeError)

      if (this.iframeSrc) {
        this.iframeElement.src = this.iframeSrc
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    // Clean up event listeners
    if (this.iframeElement) {
      this.iframeElement.removeEventListener('load', this.handleIframeLoad)
      this.iframeElement.removeEventListener('error', this.handleIframeError)
      this.iframeElement = null
    }
  }

  closeModal() {
    this.isOpen = false
    this.iframeSrc = ''
  }
}

export function createWalletPopup(): ModalPopup | null {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof customElements === 'undefined') {
    return null
  }
  // Manually register the custom element
  if (!customElements.get('up-wallet-popup')) {
    customElements.define('up-wallet-popup', ModalPopup)
  }
  const existingPopup: ModalPopup | null = (document.querySelector('up-wallet-popup') || null) as ModalPopup | null
  if (existingPopup) {
    return existingPopup
  }
  const popup = document.createElement('up-wallet-popup') as ModalPopup
  document.body.appendChild(popup)
  return popup
}
