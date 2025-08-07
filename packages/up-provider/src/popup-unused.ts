import debug from 'debug'
import { LitElement, html, css, type PropertyDeclarations } from 'lit'

const popupLog = debug('upProvider:popup')

/**
 * Small lit component to work on popup.
 * This is not being called quite yet but will be the way to support
 * the popup in the future.
 */
export class ModalPopup extends LitElement {
  /** @internal */
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
  contentWindow: Window | undefined

  private iframeElement: HTMLIFrameElement | undefined
  private promise: Promise<Window> | undefined

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
    this.contentWindow = contentWindow || undefined
    this.resolve?.(contentWindow)
  }

  handleIframeError = (e: ErrorEvent) => {
    this.reject?.(e.error)
    this.closeModal()
  }

  private resolve?: (window: Window | null) => void
  private reject?: (error: Error) => void

  async createModal(): Promise<{ isNew: boolean; window: Window }> {
    if (this.promise) {
      popupLog('Reusing popup')
      return this.promise.then(window => ({
        isNew: false,
        window,
      }))
    }
    popupLog('Constructing popup')
    this.promise = new Promise<Window | null>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    }).then((window: Window | null) => {
      if (!window) {
        throw new Error('Failed to create popup window')
      }
      return window
    })
    return this.promise.then(window => {
      return {
        isNew: true,
        window,
      }
    })
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
      this.iframeElement = undefined
    }
  }

  openModal() {
    this.isOpen = true
    popupLog('Opening popup')
    this.dispatchEvent(new CustomEvent('open', { bubbles: true, composed: true }))
    window.parent.postMessage({ type: 'upProvider:modalOpened' }, '*')
  }

  closeModal() {
    this.isOpen = false
    this.iframeSrc = ''
    popupLog('Closing popup')
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
    window.parent.postMessage({ type: 'upProvider:modalClosed' }, '*')
  }

  destroyModal() {
    this.contentWindow = undefined
    this.closeModal()
    this.remove()
    popupLog('Destroying popup')
    this.dispatchEvent(new CustomEvent('destroy', { bubbles: true, composed: true }))
  }
}

export async function createWalletPopup(_url: string): Promise<{ popup: ModalPopup; isNew: boolean }> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof customElements === 'undefined') {
    throw new Error('This function can only be called in a browser environment.')
  }
  const url = new URL(_url)
  const key = `up-wallet-popup-${url.hostname.replace(/\./g, '-')}${url.pathname.split('/').join('-')}`
  // Manually register the custom element
  if (!customElements.get('up-wallet-popup')) {
    customElements.define('up-wallet-popup', ModalPopup)
  }
  const existingPopup: ModalPopup | null = (document.querySelector(`#${key}`) || null) as ModalPopup | null
  if (existingPopup) {
    return { isNew: false, popup: existingPopup }
  }
  popupLog('Instantiating new popup')
  const popup = document.createElement('up-wallet-popup') as ModalPopup
  popup.id = key
  const urlAttr = document.createAttribute('iframeSrc')
  urlAttr.value = _url
  popup.attributes.setNamedItem(urlAttr)
  document.body.appendChild(popup)
  return popup
    .createModal()
    .then(({ isNew }) => {
      return { isNew, popup }
    })
    .catch(error => {
      popupLog('Error creating popup:', error)
      popup.destroyModal()
      throw error
    })
}
