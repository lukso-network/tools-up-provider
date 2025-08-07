import debug from 'debug'

const popupLog = debug('upProvider:popup')

export interface ModalPopup {
  openModal(): void
  closeModal(): void
  destroyModal(): void
  createModal(): Promise<{ isNew: boolean; window: Window }>
  isOpen: boolean
  contentWindow?: Window
}

class VanillaModalPopup implements ModalPopup {
  private modalElement: HTMLDivElement
  private iframeElement: HTMLIFrameElement
  private closeButton: HTMLSpanElement
  private iframeSrc: string
  private promise?: Promise<Window>
  private resolve?: (window: Window) => void
  private reject?: (error: Error) => void
  
  isOpen = false
  contentWindow?: Window

  constructor(iframeSrc: string, id: string) {
    this.iframeSrc = iframeSrc
    
    // Create modal structure
    this.modalElement = document.createElement('div')
    this.modalElement.id = id
    this.modalElement.className = 'up-modal'
    this.modalElement.innerHTML = `
      <div class="up-modal-content">
        <span class="up-close-button">&times;</span>
        <iframe src="about:blank"></iframe>
      </div>
    `
    
    // Get references
    this.closeButton = this.modalElement.querySelector('.up-close-button')!
    this.iframeElement = this.modalElement.querySelector('iframe')!
    
    // Bind events
    this.closeButton.addEventListener('click', () => this.closeModal())
    // this.modalElement.addEventListener('click', (e) => {
    //   if (e.target === this.modalElement) {
    //     this.closeModal()
    //   }
    // })
    
    this.iframeElement.addEventListener('load', this.handleIframeLoad)
    this.iframeElement.addEventListener('error', this.handleIframeError)
    
    // Add styles if not already present
    if (!document.getElementById('up-modal-styles')) {
      const style = document.createElement('style')
      style.id = 'up-modal-styles'
      style.textContent = `
        .up-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
        .up-modal.show {
          display: flex;
        }
        .up-modal-content {
          background-color: #fff;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          width: 480px;
          height: 640px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        @media (max-width: 768px) {
          .up-modal-content {
            width: 100%;
            height: 100%;
            border-radius: 0;
          }
        }
        .up-close-button {
          position: absolute;
          top: 10px;
          right: 15px;
          font-size: 24px;
          cursor: pointer;
          z-index: 10;
          color: #000;
          background: rgba(255, 255, 255, 0.8);
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .up-close-button:hover {
          background: rgba(255, 255, 255, 1);
        }
        .up-modal iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      `
      document.head.appendChild(style)
    }
    
    // Add to DOM
    document.body.appendChild(this.modalElement)
  }

  private handleIframeLoad = () => {
    popupLog('Iframe loaded, contentWindow:', this.iframeElement.contentWindow)
    this.contentWindow = this.iframeElement.contentWindow || undefined
    this.resolve?.(this.contentWindow!)
  }

  private handleIframeError = (e: ErrorEvent) => {
    popupLog('Iframe error occurred:', e.error, e.message)
    this.reject?.(e.error)
    this.closeModal()
  }

  async createModal(): Promise<{ isNew: boolean; window: Window }> {
    popupLog('createModal called, has promise:', !!this.promise, 'iframe src:', this.iframeSrc)
    
    if (this.promise) {
      popupLog('Reusing existing popup promise')
      return this.promise.then(window => ({
        isNew: false,
        window,
      }))
    }
    
    popupLog('Creating new popup promise')
    
    this.promise = new Promise<Window>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
      
      // Set the iframe src first
      if (this.iframeSrc) {
        this.iframeElement.src = this.iframeSrc
      }
      
      // Auto-open in debug mode after iframe src is set
      const debugMode = window.location.search.includes('debug=true') || 
                       localStorage.getItem('upProvider:debug') === 'true'
      if (debugMode) {
        // Delay to ensure iframe starts loading
        setTimeout(() => this.openModal(), 100)
      }
    })
    
    return this.promise.then(window => ({
      isNew: true,
      window,
    }))
  }

  openModal() {
    // Use requestAnimationFrame to ensure DOM is ready and styles are applied
    requestAnimationFrame(() => {
      this.isOpen = true
      this.modalElement.classList.add('show')
      popupLog('Opening popup')
      
      // Dispatch custom event
      this.modalElement.dispatchEvent(new CustomEvent('open', { 
        bubbles: true, 
        composed: true 
      }))
      
      window.parent.postMessage({ type: 'upProvider:modalOpened' }, '*')
    })
  }

  closeModal() {
    // Log the call stack to see what's triggering the close
    popupLog('closeModal called from:', new Error().stack)
    
    // Debug mode - check for debug flag in URL or localStorage
    const debugMode = window.location.search.includes('debug=true') || 
                     localStorage.getItem('upProvider:debug') === 'true'
    
    if (debugMode) {
      popupLog('Debug mode: keeping modal open')
      return
    }
    
    this.isOpen = false
    this.modalElement.classList.remove('show')
    popupLog('Closing popup')
    
    // Dispatch custom event
    this.modalElement.dispatchEvent(new CustomEvent('close', { 
      bubbles: true, 
      composed: true 
    }))
    
    window.parent.postMessage({ type: 'upProvider:modalClosed' }, '*')
  }

  destroyModal() {
    this.contentWindow = undefined
    this.closeModal()
    
    // Remove event listeners
    this.iframeElement.removeEventListener('load', this.handleIframeLoad)
    this.iframeElement.removeEventListener('error', this.handleIframeError)
    
    // Remove from DOM
    this.modalElement.remove()
    
    popupLog('Destroying popup')
    
    // Dispatch custom event
    this.modalElement.dispatchEvent(new CustomEvent('destroy', { 
      bubbles: true, 
      composed: true 
    }))
  }
}

export async function createWalletPopup(_url: string): Promise<{ popup: ModalPopup; isNew: boolean }> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('This function can only be called in a browser environment.')
  }
  
  const url = new URL(_url)
  const key = `up-wallet-popup-${url.hostname.replace(/\./g, '-')}${url.pathname.split('/').join('-')}`
  
  // Check for existing popup
  const existingElement = document.getElementById(key)
  if (existingElement && (existingElement as any)._popup) {
    return { isNew: false, popup: (existingElement as any)._popup }
  }
  
  popupLog('Instantiating new popup')
  const popup = new VanillaModalPopup(_url, key)
  
  // Store reference on the element for reuse
  const element = document.getElementById(key)
  if (element) {
    (element as any)._popup = popup
  }
  
  return popup.createModal()
    .then(({ isNew }) => ({ isNew, popup }))
    .catch(error => {
      popupLog('Error creating popup:', error)
      popup.destroyModal()
      throw error
    })
}