import debug from 'debug'
import EventEmitter3, { type EventEmitter } from 'eventemitter3'
import { JSONRPCClient, type JSONRPCParams } from 'json-rpc-2.0'
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid'
import image from './UniversalProfiles_Apps_Logo_96px.svg'
import { create } from 'domain'
import { createWalletPopup, type ModalPopup } from './popup'
import { cleanupAccounts } from './index'
import { start } from 'repl'

const clientLog = debug('upProvider:client')

// Unique identifier for UP Provider JSONRPC messages
const UP_PROVIDER_JSONRPC_TYPE = 'upProvider:jsonrpc' as const

type RequestQueueItem = {
  resolve: (value: void | PromiseLike<void>) => unknown
  reject: (reason: unknown) => unknown
  sent: boolean
  id: number | string
  method: string
  params: unknown[]
}

type UPWindowConfig =
  | Window
  | null
  | undefined
  | {
      url: string
      mode: 'popup' | 'iframe'
      name?: string
      get: () => Promise<Record<string, unknown>>
      set: (value: Record<string, unknown>) => Promise<void>
      preventRegistration?: boolean
      rdns?: string
      icon?: string
    }

interface UPClientProviderEvents {
  connect: (args: { chainId: `0x${string}` }) => void
  disconnect: () => void
  accountsChanged: (accounts: `0x${string}`[]) => void
  contextAccountsChanged: (contextAccounts: `0x${string}`[]) => void
  requestAccounts: (accounts: `0x${string}`[]) => void
  chainChanged: (chainId: number) => void
  injected: (page: `0x${string}`) => void
  rpcUrls: (rpcUrls: string[]) => void
  windowClosed: () => void
  initialized: () => void
}

/**
 * Internal closure for UPClientProvider to allow late initialization of class.
 */
type UPClientProviderOptions = {
  client?: JSONRPCClient
  chainId: () => number
  switchChainId: (chainId: number) => void
  connectEmitted: boolean
  allowedAccounts: () => `0x${string}`[]
  contextAccounts: () => `0x${string}`[]
  window?: Window
  clientChannel?: MessagePort
  startupPromise: Promise<void>
  popup?: ModalPopup
  preStartupPromise: Promise<void>
  allocateConnection: () => Promise<void>
  isPopup?: boolean
  isIframe?: boolean
  loginPromise?: PromiseLike<any>
  restart: () => void
  init?: {
    chainId: number
    allowedAccounts: `0x${string}`[]
    contextAccounts: `0x${string}`[]
    rpcUrls: string[]
  }
}

const pendingRequests = new Map<string, RequestQueueItem>()

/**
 * Public interface for UPClientProvider.
 */
interface UPClientProvider {
  get isUPClientProvider(): boolean
  /**
   * Return an array listing the events for which the emitter has registered
   * listeners.
   */
  eventNames(): Array<EventEmitter.EventNames<UPClientProviderEvents>>

  /**
   * Return the listeners registered for a given event.
   */
  listeners<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T): Array<EventEmitter.EventListener<UPClientProviderEvents, T>>

  /**
   * Return the number of listeners listening to a given event.
   */
  listenerCount(event: EventEmitter.EventNames<UPClientProviderEvents>): number

  /**
   * Calls each of the listeners registered for a given event.
   */
  emit<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, ...args: EventEmitter.EventArgs<UPClientProviderEvents, T>): boolean

  /**
   * Add a listener for a given event.
   */
  on<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, fn: EventEmitter.EventListener<UPClientProviderEvents, T>, context?: any): this
  addListener<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, fn: EventEmitter.EventListener<UPClientProviderEvents, T>, context?: any): this

  /**
   * Add a one-time listener for a given event.
   */
  once<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, fn: EventEmitter.EventListener<UPClientProviderEvents, T>, context?: any): this

  /**
   * Remove the listeners of a given event.
   */
  removeListener<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, fn?: EventEmitter.EventListener<UPClientProviderEvents, T>, context?: any, once?: boolean): this
  off<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, fn?: EventEmitter.EventListener<UPClientProviderEvents, T>, context?: any, once?: boolean): this

  /**
   * Remove all listeners, or those of the specified event.
   */
  removeAllListeners(event?: EventEmitter.EventNames<UPClientProviderEvents>): this

  request(method: string, params?: JSONRPCParams, clientParams?: any): Promise<any>
  request(method: { method: string; params?: JSONRPCParams }, clientParams?: any): Promise<any>

  /**
   * Get the current chainId this is configured for and connected to.
   */
  get chainId(): number

  /**
   * Mirrors allowedAccounts, the accounts the provider is connected to
   */
  get accounts(): `0x${string}`[]

  /**
   * Additional context accounts provided by the parent connector.
   * Inside of the universaleverything grid this will contain the account
   * of the owner of the displayed grid (i.e. the owner of the profile being displayed.)
   */
  get contextAccounts(): `0x${string}`[]

  get isConnected(): boolean

  get isMiniApp(): Promise<boolean>

  resume(delay?: number): void
}

/**
 * Internal class for UPClientProvider.
 */
class _UPClientProvider extends EventEmitter3<UPClientProviderEvents> {
  readonly #options: UPClientProviderOptions
  #buffered?: Array<[keyof UPClientProviderEvents, unknown[]]> = []
  constructor(options: any) {
    super()
    this.#options = options as UPClientProviderOptions
  }

  emit<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, ...args: EventEmitter.EventArgs<UPClientProviderEvents, T>): boolean {
    if (this.#buffered) {
      this.#buffered.push([event, args])
      return false
    }
    return super.emit(event, ...args)
  }

  resume(delay = 0) {
    const buffered = this.#buffered
    if (!buffered) {
      return
    }
    this.#buffered = undefined
    setTimeout(() => {
      while (buffered.length > 0) {
        const val = buffered.shift()
        if (val) {
          const [event, args] = val
          super.emit(event, ...(args as any))
        }
      }
    }, delay)
  }

  on<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, fn: EventEmitter.EventListener<UPClientProviderEvents, T>, context?: any) {
    this.resume(500)
    return super.on(event, fn, context)
  }
  addListener<T extends EventEmitter.EventNames<UPClientProviderEvents>>(event: T, fn: EventEmitter.EventListener<UPClientProviderEvents, T>, context?: any) {
    this.resume(500)
    return super.addListener(event, fn, context)
  }

  private _getOptions = () => {
    return this.#options
  }

  get isUPClientProvider(): boolean {
    return true
  }

  get isConnected(): boolean {
    return this._getOptions().allowedAccounts().length > 0
  }

  get isMiniApp(): Promise<boolean> {
    return this._getOptions()
      ?.startupPromise.catch(() => false)
      .then(() => true)
  }

  async request(method: { method: string; params?: JSONRPCParams }, clientParams?: any): Promise<any>
  async request(method: string, params?: JSONRPCParams, clientParams?: any): Promise<any>
  async request(_method: string | { method: string; params?: JSONRPCParams }, _params?: JSONRPCParams, _clientParams?: any): Promise<any> {
    // Remove debug log now that connection is working
    await this._getOptions()?.preStartupPromise
    const method = typeof _method === 'string' ? _method : _method.method
    const params = typeof _method === 'string' ? _params : _method.params
    if (!this._getOptions()?.client) {
      if (this._getOptions()?.isPopup && (this._getOptions().isIframe || method === 'eth_sendTransaction' || method === 'eth_requestAccounts' || (method === 'eth_accounts' && this.accounts?.length === 0))) {
        await this._getOptions()?.allocateConnection()
        await this._getOptions()?.startupPromise
      }
    }
    if (method === 'eth_requestAccounts' || method === 'wallet_requestPermissions') {
      if (this._getOptions()?.isIframe && this._getOptions().popup && !this.accounts?.length) {
        this._getOptions().popup?.openModal()
        if (!this._getOptions().loginPromise) {
          this._getOptions().loginPromise = this._getOptions()
            .client?.request('embedded_login', ['force'], _clientParams)
            .then((result: unknown) => {
              console.log('embedded_login', result)
            })
        }
        await this._getOptions().loginPromise
      }
    }
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
      if (this.chainId && this.accounts.length > 0) {
        if (!this._getOptions()?.connectEmitted) {
          this.emit('connect', { chainId: `0x${this.chainId.toString(16)}` })
          this._getOptions().connectEmitted = true
        }
      } else {
        this._getOptions().connectEmitted = false
      }
      return this.accounts
    }
    if (method === 'eth_chainId') {
      return `0x${this.chainId.toString(16)}`
    }
    if (method === 'wallet_switchEthereumChain') {
      this._getOptions().switchChainId(Number(params?.[0]?.chainId))
      return `0x${this.chainId.toString(16)}`
    }
    if (method === 'eth_accounts') {
      return this.accounts
    }
    // Internally this will decode method.method and method.params if it was sent.
    // i.e. this method is patched.
    const clientParams = typeof _method === 'string' ? _clientParams : _params
    if (method === 'up_contextAccounts') {
      return this._getOptions().contextAccounts()
    }
    
    // Ensure client is allocated before making request
    if (!this._getOptions()?.client) {
      clientLog('Client not ready, allocating connection first')
      await this._getOptions()?.allocateConnection()
      await this._getOptions()?.startupPromise
    }
    
    // For wallet_requestPermissions, handle the response to update accounts
    if (method === 'wallet_requestPermissions') {
      const result = await this._getOptions()?.client?.request(method, params, clientParams)
      if (result && result[0]?.accounts) {
        const newAccounts = result[0].accounts as `0x${string}`[]
        const currentAccounts = this._getOptions()?.allowedAccounts() || []
        
        // Use the same comparison logic as elsewhere in the code
        if ((currentAccounts?.length ?? 0) !== (newAccounts?.length ?? 0) || currentAccounts?.some((account, index) => account !== newAccounts[index])) {
          // Emit the event - the actual account update will happen when we receive the accountsChanged event
          clientLog('wallet_requestPermissions returned different accounts, expecting accountsChanged event')
          // The server should send accountsChanged, but if not, we can emit it ourselves
          // For now, just log it
        }
      }
      return result
    }
    
    return this._getOptions()?.client?.request(method, params, clientParams) || null
  }

  get chainId() {
    return this._getOptions()?.chainId() || 0
  }

  get accounts() {
    return this._getOptions()?.allowedAccounts() || []
  }

  get contextAccounts() {
    return this._getOptions()?.contextAccounts() || []
  }
}

/**
 * @internal
 * Search for the parent provider and connect it. This routine is internally called
 * @param up - search input if specific window should be pinged.
 * @param remote - the provider doing the pinging.
 * @param options - the internal closure for that provider.
 * @returns The provider if it successfully connected or throws an error.
 */
async function testWindow(up: Window | undefined | null, remote: UPClientProvider, options: UPClientProviderOptions): Promise<UPClientProvider> {
  const _up = up || (typeof window !== 'undefined' ? window.parent : undefined)
  if (!_up) {
    throw new Error('No UP found')
  }
  clientLog('test window', _up, up)
  return new Promise<UPClientProvider>((resolve, reject) => {
    let timeout: number | NodeJS.Timeout = 0
    const channel = new MessageChannel()

    const testFn = (event: MessageEvent) => {
      // Handle wrapped JSONRPC responses for cross-origin scenarios
      if (event.data?.type === UP_PROVIDER_JSONRPC_TYPE && !options.clientChannel) {
        const jsonrpcMessage = event.data.payload
        if (jsonrpcMessage && typeof jsonrpcMessage.id !== 'undefined') {
          // This is a JSONRPC response, handle it
          const pending = pendingRequests.get(String(jsonrpcMessage.id))
          if (pending) {
            if (jsonrpcMessage.error) {
              pending.reject(jsonrpcMessage.error)
            } else {
              pending.resolve(jsonrpcMessage.result)
            }
            pendingRequests.delete(String(jsonrpcMessage.id))
          }
        }
        return
      }

      if (event.data?.type === 'upProvider:windowInitialize') {
        const { chainId, allowedAccounts, contextAccounts, rpcUrls } = event.data

        clientLog('client init', event.data, _up)
        window.removeEventListener('message', testFn)
        if (timeout) {
          clearTimeout(timeout)
          timeout = 0
        }

        // Check if we received a port from the server (cross-origin case)
        if (event.ports?.[0]) {
          clientLog('Received MessageChannel port from server')
          options.clientChannel = event.ports[0]
          // Don't start yet - will start after listener is attached in doSearch
        } else {
          // Use our original port (same-origin case)
          options.clientChannel = channel.port1
          // Don't start yet - will start after listener is attached in doSearch
        }

        options.window = _up
        try {
          _up.addEventListener('close', () => {
            options.restart()
            remote.emit('windowClosed')
          })
        } catch {
          // Ignore
        }
        options.init = { chainId, allowedAccounts, contextAccounts, rpcUrls }
        clientLog('client connected', event.data.type, event.data)
        options.clientChannel.postMessage({
          type: 'upProvider:windowInitialized',
          chainId,
          allowedAccounts,
          contextAccounts,
          rpcUrls,
        })
        resolve(remote)
      }
    }

    // Only listen on channel.port1 if we're expecting to use it (same-origin)
    // For cross-origin, we'll receive a port from the server
    channel.port1.addEventListener('message', testFn)
    channel.port1.start()
    window.addEventListener('message', testFn)
    clientLog('client', 'send find wallet', _up)

    // Check if we can access the window's origin (same-origin check)
    let canTransferPort = false
    try {
      // If we can access the location, we're same-origin
      const _ = _up.location.href
      canTransferPort = true
    } catch (e) {
      // Cross-origin - can't transfer MessageChannel
      clientLog('Cross-origin detected, will send without port')
    }

    // Use stored target origin or default to '*'
    const targetOrigin = (options as any).targetOrigin || '*'
    clientLog('Using target origin for postMessage:', targetOrigin)

    // Determine which message to send based on the context
    let messageType = 'upProvider:hasProvider'

    // If we're looking for an iframe provider (authURL has a URL), use a specific message
    if ((options as any).isIframe) {
      messageType = 'upProvider:requestIframeProvider'
    }

    // Send with or without port based on origin check
    if (canTransferPort) {
      _up.postMessage(messageType, targetOrigin, [channel.port2])
    } else {
      _up.postMessage(messageType, targetOrigin)
    }

    timeout = setTimeout(() => {
      timeout = 0
      window.removeEventListener('message', testFn)
      channel.port1.removeEventListener('message', testFn)

      clientLog('client', 'No UP found', _up)
      reject(new Error('No UP found'))
    }, 1000)
  })
}

/**
 * Find the up connector in the parent or popup window.
 * @param authURL - optionlly pass a URL for a popup to be launched in an iframe to connect
 * @param remote - the up provider to be connect
 * @param options - the internal closure for that provider.
 * @returns
 */
async function findUP(authURL: UPWindowConfig, remote: UPClientProvider, options: UPClientProviderOptions): Promise<UPClientProvider | undefined> {
  const current = typeof window !== 'undefined' && window instanceof Window ? window.opener || window.parent : null
  if (current) {
    clientLog('finding', current, typeof window !== 'undefined' ? window : undefined)
    const up = await testWindow(current, remote, options)
    if (up) {
      return up
    }
  }
  if (authURL == null) {
    throw new Error('No UP found')
  }
  if (typeof authURL === 'object' && authURL instanceof Window) {
    throw new Error('No UP found')
  }
  throw new Error('No UP found')
}

/**
 * Helper routines to initiate the search procedure for the parent provider.
 * @param authURL - optional URL for popup window
 * @param remote - the up provider to be connected
 * @param options - the internal closure for that provider.
 * @param search - if true then it will search, else it expects either a window or URL.
 * @returns The connected provider or throws an error.
 */
async function findDestination(authURL: UPWindowConfig, remote: UPClientProvider, options: UPClientProviderOptions, search = false): Promise<UPClientProvider> {
  let theWindow: UPWindowConfig = typeof authURL === 'object' && (authURL as { url?: string })?.url ? null : authURL

  // Store the target origin in options for use in testWindow
  if (typeof authURL === 'object' && !(authURL instanceof Window) && authURL?.url) {
    try {
      ;(options as any).targetOrigin = new URL(authURL.url).origin
      clientLog('Stored target origin:', (options as any).targetOrigin)
    } catch (e) {
      clientLog('Could not determine target origin from URL')
    }
  }

  if (typeof authURL === 'object' && !(authURL instanceof Window) && authURL?.url) {
    const info = localStorage.getItem(`upProvider:info:${authURL}`)
    if (info) {
      const { chainId, allowedAccounts, contextAccounts, rpcUrls } = JSON.parse(info)
      options.init = { chainId, allowedAccounts, contextAccounts, rpcUrls }
    }
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (authURL.mode === 'popup') {
        const childWindow = window.open(authURL.url, 'UE Wallet', 'width=400,height=600')
        if (childWindow) {
          clientLog('popup opened')
          await new Promise<void>(resolve => {
            childWindow.onload = () => {
              resolve()
            }
          })
          childWindow.addEventListener('close', () => {
            clientLog('popup closed')
            options.restart()
            remote.emit('windowClosed')
          })
          theWindow = childWindow
        }
      }
      if (authURL.mode === 'iframe') {
        const { popup, isNew } = await createWalletPopup(authURL.url)
        if (popup) {
          options.popup = popup
          const { window: current } = await popup.createModal()

          if (current) {
            clientLog(isNew ? 'New iframe created' : 'Reusing existing iframe')

            // Only set up event listeners for new popups
            if (isNew) {
              const close = (event: MessageEvent) => {
                if (event.data?.type === 'upProvider:modalClosed') {
                  clientLog('iframe modal closed (keeping connection)')
                  // Don't restart or emit windowClosed - just hide the modal
                  // The connection should persist
                  window.removeEventListener('message', close)
                }
              }
              window.addEventListener('message', close)
              try {
                current.addEventListener('close', () => {
                  clientLog('iframe window actually closed')
                  // Only restart if the window is actually destroyed, not just hidden
                  options.restart()
                  remote.emit('windowClosed')
                  window.removeEventListener('message', close)
                })
              } catch {
                // Ignore - cross-origin frames might not allow this
              }
            }

            theWindow = current

            // Only wait for ready message on new iframes
            if (authURL.mode === 'iframe' && current && isNew) {
              clientLog('Waiting for iframe to announce ready')
              await new Promise<void>(resolve => {
                let timeoutId: NodeJS.Timeout | number
                
                const readyHandler = (event: MessageEvent) => {
                  // Debug logging
                  if (event.data === 'upProvider:ready') {
                    clientLog('Received upProvider:ready from:', event.source, 'expected:', current, 'match:', event.source === current)
                  }

                  // For cross-origin iframes, event.source might not be accessible or comparable
                  // So just check for the message type
                  if (event.data === 'upProvider:ready') {
                    clientLog('Iframe announced ready')
                    clearTimeout(timeoutId)  // Clear the timeout since we got the ready message
                    window.removeEventListener('message', readyHandler)
                    resolve()
                  }
                }
                window.addEventListener('message', readyHandler)

                // Timeout after 3 seconds - this is expected if the iframe doesn't send ready
                timeoutId = setTimeout(() => {
                  window.removeEventListener('message', readyHandler)
                  clientLog('Iframe ready timeout (proceeding anyway - this is normal)')
                  resolve()
                }, 3000)
              })
            }
          }
        }
      }
    }
  }
  let up: UPClientProvider | undefined = await testWindow(theWindow as Window | undefined | null, remote, options).catch(error => {
    if (search) {
      return undefined
    }
    throw error
  })

  if (search && !up) {
    let retry = 3
    while (retry > 0) {
      let current: Window | undefined = theWindow || (window.opener && window.opener !== window ? window.opener : window.parent && window.parent !== window ? window.parent : undefined)
      clientLog('search', current)
      while (current) {
        up = await testWindow(current, remote, options).catch(() => undefined)
        if (up) {
          break
        }
        if (current === window.top) {
          break
        }
        clientLog('current', current)
        current = theWindow || (current.opener && current.opener !== current ? current.opener : current.parent && current.parent !== current ? current.parent : undefined)
        clientLog('next', current)
      }
      if (up) {
        break
      }

      // Wait for a second for each try.
      await new Promise(resolve => setTimeout(resolve, 1000))

      retry--
    }
  }
  if (!up) {
    throw new Error('No UP found')
  }
  return up
}

/**
 * Create clientUPProvider. This can be used like a normal window.ethereum or window.lukso provider.
 * It will on initialization look for a connection to a global provider.
 *
 * @param authURL Optionally put a URL to a authentication provider to provide the global provider.
 * @param search If false then don't search but take the passed in value as is.
 * @returns the client UPProvider
 */
function createClientUPProvider(authURL?: UPWindowConfig, search = true): UPClientProvider {
  let chainId = 0
  let allowedAccounts: `0x${string}`[] = []
  let contextAccounts: `0x${string}`[] = []
  let rpcUrls: string[] = []
  let startupResolve: () => void
  let preStartupResolve: () => void = () => {}
  const preStartupPromise = new Promise<void>(resolve => {
    preStartupResolve = resolve
  }).then(() => {
    clientLog('pre startup resolved')
  })
  let startupPromise = new Promise<void>(resolve => {
    startupResolve = resolve
  }).then(() => {
    remote.emit('initialized')
  })

  const allocateConnection = async () => {
    const client = new JSONRPCClient(async (jsonRPCRequest: any) => {
      await doSearch(client).then(up => {
        options.client = client
        return up
      })

      return new Promise((resolve, reject) => {
        const { id, method, params } = jsonRPCRequest

        pendingRequests.set(id, {
          resolve,
          reject,
          sent: false,
          id,
          method,
          params,
        })

        // Debug log the request being sent
        clientLog('Sending JSONRPC request:', method, 'id:', id, 'via:', options.clientChannel ? 'MessageChannel' : 'postMessage')
        
        // Check if the channel is still valid
        if (options.clientChannel) {
          try {
            options.clientChannel.postMessage(jsonRPCRequest)
          } catch (e) {
            console.error('*** MessageChannel postMessage failed:', e)
            // Channel might be closed, need to reconnect
            clientLog('MessageChannel appears to be broken, may need to reconnect')
          }
        } else if (options.window) {
          // For cross-origin scenarios, wrap the JSONRPC message
          options.window.postMessage(
            {
              type: UP_PROVIDER_JSONRPC_TYPE,
              payload: jsonRPCRequest,
            },
            (options as any).targetOrigin || '*'
          )
        }
      })
    })

    const request_ = client.request.bind(client)

    const wrapper = async (method: string, params?: unknown[]) => {
      await preStartupPromise
      switch (method) {
        case 'eth_accounts':
        case 'eth_requestAccounts':
          if (allowedAccounts.length > 0) {
            return allowedAccounts
          }
          break
        case 'wallet_switchEthereumChain': {
          const { chainId: _chainId } = params?.[0] as { chainId: number | `0x${string}` }
          if (_chainId) {
            chainId = Number(_chainId)
            persist()
            remote.emit('chainChanged', chainId)
          }
          return `0x${chainId.toString(16)}`
        }
        case 'eth_chainId':
          return `0x${chainId.toString(16)}`
        case 'eth_call':
          // Is this call is used to evaluate or simulate a transaction then we have to send it to the parent provider.
          // Otherwise we can send it directly to a configured RPC endpoint.
          if (rpcUrls.length > 0 && Object.keys((params?.[0] ?? {}) as Record<string, unknown>).every(key => !/^gasPrice|maxFeePerGas|maxPriorityFeePerGas|value$/.test(key))) {
            clientLog('client direct rpc', rpcUrls, method, params)

            const urls = [...rpcUrls]
            const errors = []
            while (urls.length > 0) {
              const url = urls.shift()
              try {
                if (!url) {
                  throw new Error('No RPC URL found')
                }

                const result = fetch(url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: uuidv4(),
                    method,
                    params,
                  }),
                }).then(response => {
                  if (response.ok) {
                    return response.json()
                  }
                  throw new Error('Network response was not ok')
                })

                return result
              } catch (error) {
                // This is a real error log (maybe goes to sentry)
                console.error('error', error)
                errors.push(error)
              }
            }
            const err: any = new Error(`All RPC URLs failed: ${errors.map(e => (e as { message: string }).message).join(', ')}`)
            err.errors = errors
            throw err
          }
      }
      return request_(method, params)
    }

    client.request = async (method: string | { method: string; params: unknown[] }, params?: unknown[]) => {
      const methodName = typeof method === 'string' ? method : method.method
      switch (methodName) {
        case 'wallet_revokePermissions':
          // This is a special case for revoke permissions.
          if ((allowedAccounts?.length ?? 0) > 0) {
            allowedAccounts = []
            persist()
            remote.emit(
              'accountsChanged',
              // Cleanup wrong null or undefined.
              cleanupAccounts(allowedAccounts)
            )
          }
          if ((contextAccounts?.length ?? 0) > 0) {
            contextAccounts = []
            persist()
            remote.emit(
              'contextAccountsChanged',
              // Cleanup wrong null or undefined.
              cleanupAccounts(contextAccounts)
            )
          }
          remote.emit('disconnect')
          return null
      }

      await doSearch(client)

      await startupPromise

      // make it compatible with old and new type RPC.
      if (typeof method === 'string') {
        return await wrapper(method, params)
      }
      const { method: _method, params: _params } = method
      return await wrapper(_method, _params)
    }

    await doSearch(client)
  }

  const options: UPClientProviderOptions = {
    chainId: () => chainId,
    switchChainId: (_chainId: number) => {
      chainId = _chainId
      persist()
      remote.emit('chainChanged', chainId)
    },
    restart: () => {},
    connectEmitted: false,
    allowedAccounts: () => allowedAccounts,
    contextAccounts: () => contextAccounts,
    startupPromise,
    preStartupPromise,
    allocateConnection,
    isPopup: (authURL as { url?: string })?.url !== undefined,
    isIframe: (authURL as { mode?: string })?.mode === 'iframe',
  }

  options.restart = function restart() {
    clientLog('Restarting connection - cleaning up state')

    // Clean up connection state
    options.window = undefined
    options.clientChannel = undefined
    options.connectEmitted = false
    
    // Clear the search promise so next connection will set up listeners
    searchPromise = null

    // Reset the startup promise
    options.startupPromise = startupPromise = new Promise<void>(resolve => {
      startupResolve = resolve
    }).then(() => {
      remote.emit('initialized')
    })
  }

  const remote = new _UPClientProvider(options)
  let searchPromise: Promise<UPClientProvider> | null

  if (authURL && !(authURL instanceof Window)) {
    authURL.get().then((value: Record<string, unknown>) => {
      if (value.chainId) {
        chainId = value.chainId as number
      }
      if (value.allowedAccounts) {
        allowedAccounts = value.allowedAccounts as `0x${string}`[]
      }
      if (value.rpcUrls) {
        rpcUrls = value.rpcUrls as string[]
      }
      preStartupResolve()
    })
  } else {
    preStartupResolve()
  }
  if (authURL instanceof Window || !authURL || !authURL?.preventRegistration) {
    // Register the provider as a wallet by announcing it.
    const info = authURL && !(authURL instanceof Window) ? authURL : undefined
    const rdns = info?.rdns || 'dev.lukso.auth'
    const dns = rdns.split('.').reverse().join('.')
    const providerInfo = {
      uuid: uuidv5(dns, uuidv5.DNS),
      name: info?.name || 'UE Universal Profile',
      icon: info?.icon || `data:image/svg+xml,${encodeURIComponent(image)}`,
      rdns,
    }

    // Announce event.
    const announceEvent = new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ info: providerInfo, provider: remote }),
    })

    // The Wallet dispatches an announce event which is heard by
    // the DApp code that had run earlier
    window.dispatchEvent(announceEvent)

    // The Wallet listens to the request events which may be
    // dispatched later and re-dispatches the `EIP6963AnnounceProviderEvent`
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(announceEvent)
    })
  }
  const persist = () => {
    if (authURL && !(authURL instanceof Window)) {
      authURL.set({
        chainId,
        allowedAccounts,
        rpcUrls,
      })
    }
  }
  const doSearch = async (client: JSONRPCClient, force = false): Promise<UPClientProvider> => {
    if (searchPromise) {
      return searchPromise
    }
    const activeSearchPromise = findDestination(authURL, remote, options, search)
      .then(up => {
        up?.addListener('windowClosed', () => {
          searchPromise = null
        })
        const init:
          | {
              chainId: number
              allowedAccounts: `0x${string}`[]
              contextAccounts: `0x${string}`[]
              rpcUrls: string[]
            }
          | undefined = options.init
        if (init) {
          ;({ chainId, allowedAccounts, contextAccounts, rpcUrls } = init || {})
          persist()
        }
        // Set up message listener based on connection type
        if (options.clientChannel) {
          // MessageChannel-based communication (same-origin)
          clientLog('Setting up MessageChannel listener, channel exists:', !!options.clientChannel)
          options.clientChannel.addEventListener('message', event => {
            try {
              const response = event.data
              clientLog('client MessageChannel message received:', response)
              switch (response.method) {
                case 'chainChanged':
                  chainId = response.params[0]
                  persist()
                  up.emit('chainChanged', chainId)
                  return
                case 'contextAccountsChanged':
                  if ((contextAccounts?.length ?? 0) !== (response.params?.length ?? 0) || contextAccounts?.some((account, index) => account !== response.params[index])) {
                    contextAccounts = response.params
                    up.emit(
                      'contextAccountsChanged',
                      // Cleanup wrong null or undefined.
                      cleanupAccounts(contextAccounts)
                    )
                  }
                  return
                case 'accountsChanged':
                  if ((allowedAccounts?.length ?? 0) !== (response.params?.length ?? 0) || allowedAccounts?.some((account, index) => account !== response.params[index])) {
                    allowedAccounts = response.params
                    persist()
                    up.emit(
                      'accountsChanged',
                      // Cleanup wrong null or undefined.
                      cleanupAccounts(allowedAccounts)
                    )
                  }
                  return
                case 'rpcUrlsChanged':
                  rpcUrls = response.params
                  persist()
                  up.emit('rpcUrls', rpcUrls)
                  return
                case 'connect':
                  up.emit('connect', response.params[0])
                  return
                case 'disconnect':
                  options.connectEmitted = false
                  options.loginPromise = undefined
                  if ((allowedAccounts?.length ?? 0) > 0) {
                    allowedAccounts = []
                    persist()
                    up.emit(
                      'accountsChanged',
                      // Cleanup wrong null or undefined.
                      cleanupAccounts(allowedAccounts)
                    )
                  }
                  if ((contextAccounts?.length ?? 0) > 0) {
                    contextAccounts = []
                    persist()
                    up.emit(
                      'contextAccountsChanged',
                      // Cleanup wrong null or undefined.
                      cleanupAccounts(contextAccounts)
                    )
                  }
                  up.emit('disconnect')
                  return
              }
              const item = pendingRequests.get(response.id)
              clientLog('Response received for id:', response.id, 'found in pending:', !!item, 'method was:', item?.method)
              if (response.id && item) {
                const { resolve, reject } = item
                if (response.result) {
                  client.receive({ ...response, id: item.id }) // Handle the response
                  resolve() // Resolve the corresponding promise
                } else if (response.error) {
                  const { error: _error, jsonrpc } = response
                  const { method, params, id } = item
                  const error = {
                    ..._error,
                    message: `${_error.message} ${JSON.stringify(method)}(${JSON.stringify(params)})`,
                  }
                  // This is a real error log (maybe goes to sentry)
                  console.error('error', { error, method, params, id, jsonrpc })
                  client.receive({ ...response, id: item.id })
                  reject(error) // Reject in case of error
                }
                pendingRequests.delete(response.id) // Clean up the request
              }
            } catch (error) {
              // This is a real error log (maybe goes to sentry)
              console.error('Error parsing JSON RPC response', error, event)
            }
          })
          clientLog('Starting MessageChannel listener')
          options.clientChannel.start()
        } else if (options.window) {
          // Window postMessage-based communication (cross-origin)
          const messageHandler = (event: MessageEvent) => {
            // Only handle wrapped JSONRPC messages
            if (event.data?.type === UP_PROVIDER_JSONRPC_TYPE) {
              try {
                const response = event.data.payload
                clientLog('client (cross-origin)', response)
                switch (response.method) {
                  case 'chainChanged':
                    chainId = response.params[0]
                    persist()
                    up.emit('chainChanged', chainId)
                    return
                  case 'contextAccountsChanged':
                    if ((contextAccounts?.length ?? 0) !== (response.params?.length ?? 0) || contextAccounts?.some((account: any, index: number) => account !== response.params[index])) {
                      contextAccounts = response.params
                      up.emit('contextAccountsChanged', cleanupAccounts(contextAccounts))
                    }
                    return
                  case 'accountsChanged':
                    if ((allowedAccounts?.length ?? 0) !== (response.params?.length ?? 0) || allowedAccounts?.some((account: any, index: number) => account !== response.params[index])) {
                      allowedAccounts = response.params
                      persist()
                      up.emit('accountsChanged', cleanupAccounts(allowedAccounts))
                    }
                    return
                  case 'rpcUrlsChanged':
                    rpcUrls = response.params
                    persist()
                    up.emit('rpcUrls', rpcUrls)
                    return
                  case 'connect':
                    up.emit('connect', response.params[0])
                    return
                  case 'disconnect':
                    options.connectEmitted = false
                    if ((allowedAccounts?.length ?? 0) > 0) {
                      allowedAccounts = []
                      persist()
                      up.emit('accountsChanged', cleanupAccounts(allowedAccounts))
                    }
                    if ((contextAccounts?.length ?? 0) > 0) {
                      contextAccounts = []
                      persist()
                      up.emit('contextAccountsChanged', cleanupAccounts(contextAccounts))
                    }
                    up.emit('disconnect')
                    return
                }
                // Handle regular JSONRPC responses
                const item = pendingRequests.get(response.id)
                clientLog('Cross-origin response received for id:', response.id, 'found in pending:', !!item, 'method was:', item?.method)
                if (response.id && item) {
                  const { resolve, reject } = item
                  if (response.result !== undefined) {
                    client.receive({ ...response, id: item.id })
                    resolve()
                  } else if (response.error) {
                    const { error: _error, jsonrpc } = response
                    const { method, params, id } = item
                    const error = {
                      ..._error,
                      message: `${_error.message} ${JSON.stringify(method)}(${JSON.stringify(params)})`,
                    }
                    console.error('error', { error, method, params, id, jsonrpc })
                    client.receive({ ...response, id: item.id })
                    reject(error)
                  }
                  pendingRequests.delete(response.id)
                }
              } catch (error) {
                console.error('Error parsing wrapped JSON RPC response', error, event.data)
              }
            }
          }
          window.addEventListener('message', messageHandler)
        }
        options.client = client
        const fn = startupResolve
        if (fn) {
          fn()
        }
        startupResolve = () => {}
        return up
      })
      .catch(error => {
        options.client = client

        startupResolve()
        searchPromise = null
        throw error
      })
      .then(up => {
        if (!up) {
          searchPromise = null
        }
        return up
      })
    searchPromise = activeSearchPromise
    return activeSearchPromise
  }

  if (!authURL || !(authURL as { url: string; mode: 'popup' | 'iframe' })?.url || (authURL as { url: string; mode: 'popup' | 'iframe' })?.mode === 'iframe') {
    allocateConnection()
  }

  return remote
}

export { type UPClientProvider, type UPClientProviderEvents, createClientUPProvider }
