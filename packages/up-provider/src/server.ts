import debug from 'debug'
import EventEmitter3, { type EventEmitter } from 'eventemitter3'
import { type JSONRPCErrorResponse, type JSONRPCParams, JSONRPCServer, type JSONRPCSuccessResponse } from 'json-rpc-2.0'
import { v4 as uuidv4 } from 'uuid'
import { arrayChanged, cleanupAccounts } from '.'

const serverLog = debug('upProvider:server')
interface UPClientChannelEvents {
  connected: () => void
  disconnected: () => void
  contextAccountsChanged: (accounts: `0x${string}`[]) => void
  accountsChanged: (accounts: `0x${string}`[]) => void
  requestAccounts: (accounts: `0x${string}`[]) => void
  chainChanged: (chainId: number) => void
  injected: (accounts: `0x${string}`[]) => void
}

/**
 * API for client channel, each time an iframe's UPClientProvider is allocated and connected
 * the UPProviderConnector will create and emit a new UPClientChannel.
 * The UPClientChannel will have the API to control that channel.
 * The configuration will default to values from the UPProviderConnector but enable will be false.
 */
interface UPClientChannel {
  readonly window: Window
  readonly element: HTMLIFrameElement | null
  readonly id: string

  /**
   * Return an array listing the events for which the emitter has registered
   * listeners.
   */
  eventNames(): Array<EventEmitter.EventNames<UPClientChannelEvents>>

  /**
   * Return the listeners registered for a given event.
   */
  listeners<T extends EventEmitter.EventNames<UPClientChannelEvents>>(event: T): Array<EventEmitter.EventListener<UPClientChannelEvents, T>>

  /**
   * Return the number of listeners listening to a given event.
   */
  listenerCount(event: EventEmitter.EventNames<UPClientChannelEvents>): number

  /**
   * Calls each of the listeners registered for a given event.
   */
  emit<T extends EventEmitter.EventNames<UPClientChannelEvents>>(event: T, ...args: EventEmitter.EventArgs<UPClientChannelEvents, T>): boolean

  /**
   * Add a listener for a given event.
   */
  on<T extends EventEmitter.EventNames<UPClientChannelEvents>>(event: T, fn: EventEmitter.EventListener<UPClientChannelEvents, T>, context?: any): this
  addListener<T extends EventEmitter.EventNames<UPClientChannelEvents>>(event: T, fn: EventEmitter.EventListener<UPClientChannelEvents, T>, context?: any): this

  /**
   * Add a one-time listener for a given event.
   */
  once<T extends EventEmitter.EventNames<UPClientChannelEvents>>(event: T, fn: EventEmitter.EventListener<UPClientChannelEvents, T>, context?: any): this

  /**
   * Remove the listeners of a given event.
   */
  removeListener<T extends EventEmitter.EventNames<UPClientChannelEvents>>(event: T, fn?: EventEmitter.EventListener<UPClientChannelEvents, T>, context?: any, once?: boolean): this
  off<T extends EventEmitter.EventNames<UPClientChannelEvents>>(event: T, fn?: EventEmitter.EventListener<UPClientChannelEvents, T>, context?: any, once?: boolean): this

  /**
   * Remove all listeners, or those of the specified event.
   */
  removeAllListeners(event?: EventEmitter.EventNames<UPClientChannelEvents>): this

  /**
   * Resume after a delay
   * @param delay - delay in milliseconds
   */
  resume(delay: number): void
  /**
   * Send message to dapp.
   * @param method - method name/event
   * @param params - parameters
   */
  send(method: string, params: unknown[]): Promise<void>

  /**
   * This represents the normal "eth_accounts" method list.
   * @param accounts - list of addresses
   */
  setAllowedAccounts(accounts: `0x${string}`[]): Promise<void>

  /**
   * This represents the normal "eth_accounts" method list. (setter mirrors setAllowedAccounts)
   */
  set allowedAccounts(accounts: `0x${string}`[])

  /**
   * This represents the normal "eth_accounts" method list.
   * @returns list of accounts
   */
  get allowedAccounts(): `0x${string}`[]

  /**
   * These are extra accounts sent to each provider. In the ue.io grid, this is used to
   * represent the account that is the grid owner.
   * @param accounts - list of addresses
   */
  setContextAccounts(contextAccounts: `0x${string}`[]): Promise<void>

  /**
   * These are extra accounts sent to each provider. In the ue.io grid, this is used to
   * represent the account that is the grid owner. (setter mirrors setContextAccounts)
   * @param accounts - list of addresses
   */
  set contextAccounts(contextAccounts: `0x${string}`[])

  /**
   * These are extra accounts sent to each provider. In the ue.io grid, this is used to
   * represent the account that is the grid owner.
   * @returns list of addresses
   */
  get contextAccounts(): `0x${string}`[]

  /**
   * ChainId
   * @param chainId - chain id
   */
  setChainId(chainId: number): Promise<void>

  /**
   * ChainId
   * @param chainId - chain id
   */
  set chainId(chainId: number)

  /**
   * ChainId
   * @returns chain id
   */
  get chainId(): number

  /**
   * Enable or disable the channel.
   * @param enable - enable or disable the channel
   */
  setEnable(enable: boolean): Promise<void>

  /**
   * Enable or disable the channel.
   * @returns is channel enabled
   */
  get enable(): boolean

  /**
   * Enable or disable the channel.
   * @param enable - enable or disable the channel
   */
  set enable(value: boolean)

  /**
   * RPC urls
   * @param rpcUrls - list of rpc urls (used by client provider to short circuit requests)
   */
  setRpcUrls(rpcUrls: string[]): Promise<void>

  /**
   * RPC urls
   * @param rpcUrls - list of rpc urls (used by client provider to short circuit requests)
   */
  set rpcUrls(rpcUrls: string[])

  /**
   * RPC urls
   * @returns list of rpc urls (used by client provider to short circuit requests)
   */
  get rpcUrls(): string[]

  /**
   * Helper to setup the channel with all the necessary information.
   * @param enable - enable
   * @param accounts - accounts (allowed accounts)
   * @param contextAccounts - context accounts
   * @param chainId - chainId
   */
  setupChannel(enable: boolean, accounts: `0x${string}`[], contextAccounts: `0x${string}`[], chainId: number): Promise<void>

  /**
   * Close the channel
   */
  close(): void
}

class _UPClientChannel extends EventEmitter3<UPClientChannelEvents> implements UPClientChannel {
  #accounts: `0x${string}`[] = []
  #contextAccounts: `0x${string}`[] = []
  #chainId = 0
  #rpcUrls: string[] = []
  #buffered?: Array<[keyof UPClientChannelEvents, unknown[]]> = []
  #serverChannel: MessagePort
  #server: JSONRPCServer
  readonly #getter: () => boolean
  readonly #setter: (value: boolean) => void

  constructor(serverChannel: MessagePort, public readonly window: Window, public readonly element: HTMLIFrameElement | null, public readonly id: string, server: JSONRPCServer, getter: () => boolean, setter: (value: boolean) => void) {
    super()
    this.#getter = getter
    this.#setter = setter
    this.#serverChannel = serverChannel
    this.#server = server
  }

  emit<T extends EventEmitter.EventNames<UPClientChannelEvents>>(event: T, ...args: EventEmitter.EventArgs<UPClientChannelEvents, T>): boolean {
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

  public async send(method: string, params: unknown[]): Promise<void> {
    this.#serverChannel.postMessage({
      jsonrpc: '2.0',
      id: uuidv4(),
      method,
      params,
    })
  }

  public async setAllowedAccounts(accounts: `0x${string}`[]): Promise<void> {
    serverLog('allowedAccounts', accounts)
    const accountsChanged = arrayChanged(this.#accounts, accounts)
    if (accountsChanged && this.#getter()) {
      this.#accounts = [...accounts]
      await this.send('accountsChanged', cleanupAccounts(this.#getter() ? [...this.#accounts] : []))
      this.emit(this.#getter() && this.#accounts.length > 0 ? 'connected' : 'disconnected')
    }
  }
  public set allowedAccounts(accounts: `0x${string}`[]) {
    this.setAllowedAccounts(accounts)
  }
  public get allowedAccounts(): `0x${string}`[] {
    return [...this.#accounts]
  }

  public async setContextAccounts(contextAccounts: `0x${string}`[]): Promise<void> {
    serverLog('contextAccounts', contextAccounts)
    const accountsChanged = arrayChanged(this.#contextAccounts, contextAccounts)
    if (accountsChanged) {
      this.#contextAccounts = [...contextAccounts]
      await this.send('contextAccountsChanged', cleanupAccounts([...this.#contextAccounts]))
    }
  }
  public get contextAccounts(): `0x${string}`[] {
    return [...this.#contextAccounts]
  }

  public async setupChannel(enable: boolean, accounts: `0x${string}`[], contextAccounts: `0x${string}`[], chainId: number): Promise<void> {
    await this.setEnable(enable)
    await this.setAllowedAccounts(accounts)
    await this.setContextAccounts(contextAccounts)
    await this.setChainId(chainId)
  }

  public async setEnable(value: boolean): Promise<void> {
    if (value !== this.enable) {
      this.#setter(value)
      this.send('accountsChanged', cleanupAccounts(this.#getter() ? [...this.#accounts] : []))
      this.emit(this.#getter() && this.#accounts.length > 0 ? 'connected' : 'disconnected')
    }
  }
  public set enable(value: boolean) {
    this.setEnable(value)
  }
  public get enable(): boolean {
    return this.#getter()
  }

  public async setChainId(chainId: number): Promise<void> {
    if (this.#chainId !== chainId) {
      this.#chainId = chainId
      await this.send('chainChanged', [chainId])
      this.emit('chainChanged', chainId)
    }
  }
  public get chainId(): number {
    return this.#chainId
  }
  public set chainId(chainId: number) {
    this.setChainId(chainId)
  }

  public async setRpcUrls(rpcUrls: string[]): Promise<void> {
    if (arrayChanged(rpcUrls, this.#rpcUrls)) {
      this.#rpcUrls = rpcUrls
      await this.send('rpcUrlsChanged', rpcUrls)
    }
  }
  public get rpcUrls(): string[] {
    return [...this.#rpcUrls]
  }
  public set rpcUrls(rpcUrls: string[]) {
    this.setRpcUrls(rpcUrls)
  }

  public close() {
    const el: any = this.element || this.window
    if (el.upChannel === this) {
      el.upChannel = undefined
    }
    this.#serverChannel.close()
  }
}

interface UPProviderEndpointEvents {
  accountsChanged: (accounts: `0x${string}`[]) => void
  chainChanged: (chainId: number) => void
  connect: ({ chainId }: { chainId: number }) => void
  disconnect: (error: Error) => void
}
interface UPProviderEndpoint {
  on<T extends EventEmitter.EventNames<UPProviderEndpointEvents>>(event: T, fn: EventEmitter.EventListener<UPProviderEndpointEvents, T>, context?: any): this
  request(message: { method: string; params: JSONRPCParams }, clientParams?: any): Promise<any>
  request(method: string | { method: string; params: JSONRPCParams }, params?: JSONRPCParams, clientParams?: any): Promise<any>
}

type UPProviderConnectorOptions = {
  providerHandler?: (e: MessageEvent) => void
  allowedAccounts: `0x${string}`[]
  contextAccounts: `0x${string}`[]
  provider: UPProviderEndpoint
  promise: Promise<void>
  rpcUrls: string[]
  chainId: number
}

interface UPProviderConnectorEvents {
  channelCreated: (id: HTMLIFrameElement | Window | string, channel: UPClientChannel) => void
}

/**
 * API for provider connector
 */
interface UPProviderConnector {
  /**
   * Return an array listing the events for which the emitter has registered
   * listeners.
   */
  eventNames(): Array<EventEmitter.EventNames<UPProviderConnectorEvents>>

  /**
   * Return the listeners registered for a given event.
   */
  listeners<T extends EventEmitter.EventNames<UPProviderConnectorEvents>>(event: T): Array<EventEmitter.EventListener<UPProviderConnectorEvents, T>>

  /**
   * Return the number of listeners listening to a given event.
   */
  listenerCount(event: EventEmitter.EventNames<UPProviderConnectorEvents>): number

  /**
   * Calls each of the listeners registered for a given event.
   */
  emit<T extends EventEmitter.EventNames<UPProviderConnectorEvents>>(event: T, ...args: EventEmitter.EventArgs<UPProviderConnectorEvents, T>): boolean

  /**
   * Add a listener for a given event.
   */
  on<T extends EventEmitter.EventNames<UPProviderConnectorEvents>>(event: T, fn: EventEmitter.EventListener<UPProviderConnectorEvents, T>, context?: any): this
  addListener<T extends EventEmitter.EventNames<UPProviderConnectorEvents>>(event: T, fn: EventEmitter.EventListener<UPProviderConnectorEvents, T>, context?: any): this

  /**
   * Add a one-time listener for a given event.
   */
  once<T extends EventEmitter.EventNames<UPProviderConnectorEvents>>(event: T, fn: EventEmitter.EventListener<UPProviderConnectorEvents, T>, context?: any): this

  /**
   * Remove the listeners of a given event.
   */
  removeListener<T extends EventEmitter.EventNames<UPProviderConnectorEvents>>(event: T, fn?: EventEmitter.EventListener<UPProviderConnectorEvents, T>, context?: any, once?: boolean): this
  off<T extends EventEmitter.EventNames<UPProviderConnectorEvents>>(event: T, fn?: EventEmitter.EventListener<UPProviderConnectorEvents, T>, context?: any, once?: boolean): this

  /**
   * Remove all listeners, or those of the specified event.
   */
  removeAllListeners(event?: EventEmitter.EventNames<UPProviderConnectorEvents>): this

  close(): void

  get provider(): UPProviderEndpoint

  /**
   * Get a map of all clients by their ID.
   */
  get channels(): Map<string, UPClientChannel>

  /**
   * Find the client for the element, window or proxy object of the client.
   * @param id
   * @returns actual UPClientChannel
   */
  getChannel(id: string | Window | HTMLIFrameElement | UPClientChannel | null): UPClientChannel | null

  /**
   * Inject additional addresses into the client's accountsChanged event.
   * Account[0] will be linked to the signed when making transactions.
   * Starting at Account[1] is where additional addresses are injected.
   * This routine injects on all connections. You can also inject using
   * the channel's allowedAccounts method.
   * @param page list of addresses
   */
  setContextAccounts(accounts: `0x${string}`[]): Promise<void>
  set contextAccounts(accounts: `0x${string}`[])
  get contextAccounts(): `0x${string}`[]

  setAllowedAccounts(accounts: `0x${string}`[]): Promise<void>
  set allowedAccounts(accounts: `0x${string}`[])
  get allowedAccounts(): `0x${string}`[]

  setChainId(chainId: number): Promise<void>
  set chainId(chainId: number)
  get chainId(): number

  /**
   * Connect this provider externally. This will be called during initial construction
   * but can be called at a later time if desired to re-initialize or tear down
   * the connection.
   * @param provider
   * @param rpcUrls
   */
  setupProvider(provider: UPProviderEndpoint, rpcUrls: string | string[]): Promise<void>
}

class _UPProviderConnector extends EventEmitter3<UPProviderConnectorEvents> implements UPProviderConnector {
  #options: UPProviderConnectorOptions
  #channels: Map<string, UPClientChannel>

  constructor(channels: Map<string, UPClientChannel>, options: any) {
    super()
    this.#channels = channels

    // This is a private late initialization of the class properties.
    // Since there is no way to do a await inside of a constructor this is used to provide
    // certain values late, but still have them hidden from external access.
    this.#options = options as UPProviderConnectorOptions
  }

  private _getChannels = (): Map<string, UPClientChannel> => {
    return this.#channels
  }
  private _getOptions = (): UPProviderConnectorOptions => {
    return this.#options
  }

  close() {
    if (this._getOptions().providerHandler) {
      window.removeEventListener('message', this._getOptions().providerHandler as any)
    }
  }

  get provider(): UPProviderEndpoint {
    return this._getOptions().provider
  }

  async setAllowedAccounts(accounts: `0x${string}`[]): Promise<void> {
    const contextAccountsChanged = arrayChanged(this._getOptions().contextAccounts, accounts)
    if (contextAccountsChanged) {
      this._getOptions().contextAccounts = [...accounts]
      for (const item of this.channels.values()) {
        await item.setContextAccounts(cleanupAccounts(this._getOptions().contextAccounts))
      }
    }
  }
  get allowedAccounts(): `0x${string}`[] {
    return cleanupAccounts(this._getOptions().allowedAccounts)
  }
  set allowedAccounts(accounts: `0x${string}`[]) {
    this.setAllowedAccounts(accounts)
  }

  async setChainId(chainId: number): Promise<void> {
    if (this._getOptions().chainId !== chainId) {
      this._getOptions().chainId = chainId
      for (const item of this.channels.values()) {
        await item.setChainId(this._getOptions().chainId)
      }
    }
  }
  get chainId(): number {
    return this._getOptions().chainId
  }
  set chainId(chainId: number) {
    this.setChainId(chainId)
  }
  /**
   * Get a map of all clients by their ID.
   */
  get channels(): Map<string, UPClientChannel> {
    return new Map(this._getChannels())
  }

  /**
   * Find the client for the element, window or proxy object of the client.
   * @param id
   * @returns actual UPClientChannel
   */
  getChannel(id: string | Window | HTMLIFrameElement | UPClientChannel | null): UPClientChannel | null {
    let _id = id
    if (typeof _id === 'string') {
      return this._getChannels().get(_id) || null
    }
    if ('element' in (_id as any) || 'window' in (_id as any)) {
      _id = (_id as UPClientChannel).element || (_id as UPClientChannel).window
    }
    for (const item of this._getChannels().values()) {
      if (item.window === _id || item.element === _id) {
        return item
      }
    }
    return null
  }

  /**
   * Inject additional addresses into the client's accountsChanged event.
   * Account[0] will be linked to the signed when making transactions.
   * Starting at Account[1] is where additional addresses are injected.
   * This routine injects on all connections. You can also inject using
   * the channel's allowedAccounts method.
   * @param page list of addresses
   */
  async setContextAccounts(contextAccounts: `0x${string}`[]) {
    const contextAccountsChanged = arrayChanged(this._getOptions().contextAccounts, contextAccounts)
    if (contextAccountsChanged) {
      this._getOptions().contextAccounts = [...contextAccounts]
      for (const item of this.channels.values()) {
        await item.setContextAccounts(cleanupAccounts(this._getOptions().contextAccounts))
      }
    }
  }
  get contextAccounts(): `0x${string}`[] {
    return cleanupAccounts(this._getOptions().contextAccounts)
  }
  set contextAccounts(contextAccounts: `0x${string}`[]) {
    this.setContextAccounts(contextAccounts)
  }

  /**
   * Connect this provider externally. This will be called during initial construction
   * but can be called at a later time if desired to re-initialize or tear down
   * the connection.
   * @param provider
   * @param rpcUrls
   */
  async setupProvider(provider: any, rpcUrls: string | string[]): Promise<void> {
    this._getOptions().promise = new Promise<void>((resolve, reject) => {
      ;(async () => {
        try {
          this._getOptions().provider = provider
          const newRpcUrls = Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls]
          if (arrayChanged(newRpcUrls, this._getOptions().rpcUrls)) {
            this._getOptions().rpcUrls = newRpcUrls
            for (const item of this.channels.values()) {
              await item.setRpcUrls(this._getOptions().rpcUrls)
            }
          }
          const _chainId = await this._getOptions().provider.request({
            method: 'eth_chainId',
            params: [],
          })
          for (const item of this.channels.values()) {
            await item.setChainId(this._getOptions().chainId)
          }
          const _accounts = await this._getOptions().provider.request({
            method: 'eth_accounts',
            params: [],
          })
          const accountsChanged = arrayChanged(this._getOptions().allowedAccounts, _accounts)
          if (accountsChanged) {
            this._getOptions().chainId = _chainId
            this._getOptions().allowedAccounts = [..._accounts]
            for (const item of this.channels.values()) {
              await item.setAllowedAccounts(cleanupAccounts(this._getOptions().allowedAccounts))
            }
          }
          this._getOptions().provider.on('accountsChanged', async (_accounts: `0x${string}`[]) => {
            const accountsChanged = arrayChanged(this._getOptions().allowedAccounts, _accounts)
            if (accountsChanged) {
              this._getOptions().allowedAccounts = [..._accounts]
              for (const item of this.channels.values()) {
                await item.setAllowedAccounts(cleanupAccounts(this._getOptions().allowedAccounts))
              }
            }
          })
          resolve()
        } catch (err) {
          reject(err)
        }
      })()
    })
  }
}

let globalUPProvider: UPProviderConnector | null = null

/**
 * Global method to find channel in case `up-channel-connected` event was missed.
 *
 * @param id how to find the UPClientChannel instance (this can be the id, frame (not the frame's element id) or window)
 * @returns UPClientChannel
 */
function getUPProviderChannel(id: string | Window | HTMLIFrameElement | UPClientChannel | null): UPClientChannel | null {
  if (id == null) {
    return null
  }
  if (!globalUPProvider) {
    throw new Error('Global UP Provider not set up')
  }
  return globalUPProvider.getChannel(id)
}

/**
 * Install a global UPProvider inside of the particular window which will listen for client
 * connections and establish them. It will fire `up-channel-connected` on the particular iframe if it's reachable.
 * It will fire a local `channelCreated` event as well.
 *
 * @param provider the initial provider to proxy
 * @param rpcUrls rpc urls to give to the clients to locally connect for non eth_sendTransaction and so on.
 * @returns The global provider and event sing for `channelCreated` events.
 */
function createUPProviderConnector(provider?: any, rpcUrls?: string | string[]): UPProviderConnector {
  if (globalUPProvider) {
    return globalUPProvider
  }
  const channels = new Map<string, UPClientChannel>()

  // Allow for late initialization of class properties.
  const options: UPProviderConnectorOptions = {
    provider: provider ?? null,
    rpcUrls: Array.isArray(rpcUrls) ? rpcUrls : rpcUrls != null ? [rpcUrls] : [],
    chainId: 0,
    allowedAccounts: [],
    contextAccounts: [],
    promise: Promise.resolve(),
  }
  globalUPProvider = new _UPProviderConnector(channels, options)

  serverLog('server listen', window)

  // Server handler to accept new client provider connections
  options.providerHandler = (event: MessageEvent) => {
    if (event.data === 'upProvider:hasProvider') {
      let iframe: HTMLIFrameElement | null = null
      for (const element of document.querySelectorAll('iframe')) {
        if (element.contentWindow === event.source) {
          serverLog('server hasProvider', element)
          iframe = element
          break
        }
      }
      const previous = iframe ? getUPProviderChannel(iframe) : getUPProviderChannel(event.source as Window)
      let channelId: string
      const serverChannel = event.ports[0]
      const server = new JSONRPCServer()
      let enabled = false

      // Server handler to forward requests to the provider
      if (previous) {
        channelId = previous.id
      } else {
        channelId = uuidv4()
      }

      // Wrapper for representation of client connection inside of global provider space.
      const channel_ = new _UPClientChannel(
        serverChannel,
        event.source as Window,
        iframe,
        channelId,
        server,
        () => enabled,
        value => {
          enabled = value
        }
      )

      server.applyMiddleware(async (next, request) => {
        await options.promise
        const { method: _method, params: _params, id, jsonrpc } = request
        const method =
          typeof _method === 'string'
            ? _method
            : (
                _method as unknown as {
                  method: string
                  params: unknown[]
                }
              ).method
        const params =
          typeof _method === 'string'
            ? _params
            : (
                _method as unknown as {
                  method: string
                  params: unknown[]
                }
              ).params
        switch (method) {
          case 'chainChanged':
            serverLog('short circuit response', request, [options.chainId])
            channel_.emit('chainChanged', options.chainId)
            return {
              ...request,
              result: [options.chainId],
            } as JSONRPCSuccessResponse
          case 'accounts': {
            const accounts = cleanupAccounts(enabled ? [...channel_.allowedAccounts] : [])
            serverLog('short circuit response', request)
            channel_.emit('requestAccounts', accounts)
            return {
              ...request,
              result: accounts,
            } as JSONRPCSuccessResponse
          }
          case 'contextAccountsChanged': {
            const accounts = cleanupAccounts([...channel_.contextAccounts])
            serverLog('short circuit response', request)
            channel_.emit('contextAccountsChanged', accounts)
            return {
              ...request,
              result: accounts,
            } as JSONRPCSuccessResponse
          }
          case 'eth_requestAccounts': {
            const accounts = cleanupAccounts(enabled ? [...channel_.allowedAccounts] : [])
            serverLog('short circuit response', request, accounts)
            channel_.emit('requestAccounts', accounts)
            return {
              ...request,
              result: accounts,
            } as JSONRPCSuccessResponse
          }
          case 'eth_chainId':
            return {
              ...request,
              result: options.chainId,
            } as JSONRPCSuccessResponse
          case 'eth_accounts': {
            const accounts = cleanupAccounts(enabled ? [...channel_.allowedAccounts] : [])
            channel_.emit('accountsChanged', accounts)
            return {
              ...request,
              result: accounts,
            } as JSONRPCSuccessResponse
          }
        }
        try {
          if (!options.provider) {
            throw new Error('Global Provider not connected')
          }
          const response = await options.provider.request({ method, params })
          serverLog('response', request, response)
          return {
            id,
            jsonrpc,
            result: response,
          } as JSONRPCSuccessResponse
        } catch (error) {
          if (!/method (.*?) not supported./.test((error as { message: string }).message || '')) {
            console.error(error)
            const response = {
              id,
              jsonrpc,
              error,
            } as JSONRPCErrorResponse
            serverLog('response error', request, response)
            return response
          }
        }
        serverLog('request', request)
        return await next(request)
      })

      const channelHandler = (event: MessageEvent) => {
        if (event.data.type === 'upProvider:windowInitialized') {
          serverLog('channel created', event.data.type, event.data)
          globalUPProvider?.emit('channelCreated', channel_.element || channel_.window || null, channel_)
          const destination = channel_.element || channel_.window || null
          if (destination != null) {
            ;(destination as any).upChannel = channel_
            const event = new CustomEvent('up-channel-connected', {
              detail: {
                channel: channel_,
                chainId: options.chainId,
                allowedAccounts: options.allowedAccounts,
                contextAccounts: options.contextAccounts,
                rpcUrls: options.rpcUrls,
                enable: channel_.enable,
              },
            })
            destination.dispatchEvent(event)
          }
          return
        }
        serverLog('server raw', event.data)
        try {
          const request = {
            ...event.data,
            id: `${channelId}:${event.data.id}`,
          }
          server.receive(request).then(response => {
            if (response && typeof response.id === 'string') {
              if (!response.id.startsWith(`${channelId}:`)) {
                console.error(`Invalid response id ${response.id} on channel ${channelId}`)
                return
              }
              serverChannel?.postMessage({
                ...response,
                id: JSON.parse(response.id.replace(`${channelId}:`, '')),
              })
            }
          })
        } catch (error) {
          console.error('Error parsing JSON RPC request', error, event)
        }
      }

      channels.set(channelId, channel_)
      serverLog('server hasProvider', event.data, event.ports)
      serverChannel.addEventListener('message', channelHandler)
      serverChannel.start()

      serverLog('server accept', serverChannel)
      serverChannel?.postMessage({
        type: 'upProvider:windowInitialize',
        chainId: options.chainId,
        allowedAccounts: options.allowedAccounts,
        contextAccounts: options.contextAccounts,
        rpcUrls: options.rpcUrls,
      })
      channel_.emit('connected')
    }
  }
  window.addEventListener('message', options.providerHandler)
  return globalUPProvider
}

export { type UPClientChannel, type UPClientChannelEvents, type UPProviderConnector, type UPProviderConnectorEvents, type UPProviderEndpoint, type UPProviderEndpointEvents, getUPProviderChannel, createUPProviderConnector }
