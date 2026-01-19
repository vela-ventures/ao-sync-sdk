import type Transaction from "arweave/web/lib/transaction";
import type {
  PermissionType,
  GatewayConfig,
  DispatchResult,
  DataItem,
  AppInfo,
  UserTokensResult,
  UserTokensOptions,
} from "arconnect";
import { IClientOptions } from "mqtt";
import "./fonts";
import type {
  Contact,
  Wallet,
  ChainType,
  AccountType,
  MultiChainWallet,
  TypedDataParams,
} from "./types";
import { VERSION } from "./constants/version";
import { EventEmitter } from "./core/EventEmitter";
import { ModalManager } from "./core/ModalManager";
import { RequestCoordinator } from "./core/RequestCoordinator";
import { MessageHandler } from "./core/MessageHandler";
import { MqttConnectionManager } from "./core/MqttConnectionManager";
import { WindowApiInjector } from "./core/WindowApiInjector";

declare global {
  interface Window {
    __AOSYNC_VERSION__?: string;
  }
}

export default class WalletClient {
  // Core modules
  private eventEmitter: EventEmitter;
  private modalManager: ModalManager;
  private requestCoordinator: RequestCoordinator;
  private messageHandler: MessageHandler;
  private connectionManager: MqttConnectionManager;
  private windowApiInjector: WindowApiInjector;

  // Device detection
  private isAppleMobileDevice: boolean;
  private isInappBrowser: boolean;
  private isDarkMode: boolean;

  public sessionActive: boolean;

  constructor(responseTimeoutMs = 30000, txTimeoutMs = 300000) {
    if (typeof window !== "undefined") {
      const userAgent = window.navigator.userAgent;
      this.isAppleMobileDevice = /iPad|iPhone|iPod/.test(userAgent);
      this.isInappBrowser = !!window["beaconwallet"]?.version;
      this.isDarkMode = true ||
        window?.matchMedia &&
        window?.matchMedia("(prefers-color-scheme: dark)").matches;
      window.__AOSYNC_VERSION__ = VERSION;
    }

    // Initialize core modules
    this.eventEmitter = new EventEmitter();
    this.modalManager = new ModalManager(this.isDarkMode);
    this.requestCoordinator = new RequestCoordinator(
      responseTimeoutMs,
      txTimeoutMs
    );
    this.messageHandler = new MessageHandler(
      this.requestCoordinator,
      this.modalManager,
      this.eventEmitter
    );
    this.connectionManager = new MqttConnectionManager(
      this.modalManager,
      this.messageHandler,
      this.requestCoordinator,
      this.isDarkMode,
      this.isAppleMobileDevice,
      this.isInappBrowser
    );
    this.windowApiInjector = new WindowApiInjector();

    // Session state
    this.sessionActive =
      typeof window !== "undefined" &&
      typeof sessionStorage !== "undefined" &&
      !!sessionStorage.getItem("aosync-topic-id");
    if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        "aosync-session-active",
        `${!!sessionStorage.getItem("aosync-topic-id")}`
      );
    }
  }

  // Connection Methods
  public async connect({
    permissions = [
      "ACCESS_ADDRESS",
      "ACCESS_ALL_ADDRESSES",
      "ACCESS_ARWEAVE_CONFIG",
      "ACCESS_PUBLIC_KEY",
      "ACCESS_TOKENS",
      "DECRYPT",
      "DISPATCH",
      "ENCRYPT",
      "SIGNATURE",
      "SIGN_TRANSACTION",
    ],
    appInfo = { name: "unknown", logo: "app logo" },
    gateway = {
      host: "arweave.net",
      port: 443,
      protocol: "https",
    },
    brokerUrl = "wss://aosync-broker-eu.beaconwallet.dev:8081",
    options = { protocolVersion: 5 },
    accountType = "arweave",
  }: {
    permissions?: PermissionType[];
    appInfo?: AppInfo;
    gateway?: GatewayConfig;
    brokerUrl?: string;
    options?: IClientOptions;
    accountType?: AccountType;
  }): Promise<void> {
    return this.connectionManager.connect(
      { permissions, appInfo, gateway, brokerUrl, options, accountType },
      this
    );
  }

  public async reconnect(
    brokerUrl = "wss://aosync-broker-eu.beaconwallet.dev:8081",
    options: IClientOptions = {
      protocolVersion: 5,
    }
  ): Promise<void> {
    if (this.messageHandler.getReconnectListener() != null) return;

    const sessionStorageTopicId =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("aosync-topic-id")
        : null;
    if (sessionStorageTopicId === null) return;

    try {
      this.populateWindowObject();
      await this.connectionManager.reconnect(brokerUrl, options, this);
    } catch (error) {
      this.requestCoordinator.clearPendingRequests();
      await this.disconnect();
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    this.windowApiInjector.restoreBackup();
    await this.connectionManager.disconnect(this);
  }

  public cancelConnection(): void {
    this.connectionManager.callConnectionListener("connection_canceled");
  }

  // Wallet Info Query Methods
  public async getActiveAddress(chain?: ChainType): Promise<string> {
    return this.createResponsePromise("getActiveAddress", {
      ...(chain && { chain })
    });
  }

  public async getAllAddresses(): Promise<string[]> {
    return this.createResponsePromise("getAllAddresses");
  }

  public async getPermissions(): Promise<PermissionType[]> {
    if (!this.connectionManager.getClient()) {
      return [];
    }
    return this.createResponsePromise("getPermissions");
  }

  public async getWalletNames(): Promise<{ [addr: string]: string }> {
    return this.createResponsePromise("getWalletNames");
  }

  public async getWallets(): Promise<Wallet[]> {
    return this.createResponsePromise("getWallets");
  }

  public async encrypt(
    data: BufferSource,
    algorithm?: RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams
  ): Promise<Uint8Array> {
    return this.createResponsePromise("encrypt", {
      data: data + "",
      algorithm,
    });
  }

  public async decrypt(
    data: BufferSource,
    algorithm?: RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams
  ): Promise<Uint8Array> {
    return this.createResponsePromise("decrypt", {
      data: data + "",
      algorithm,
    });
  }

  public async getArweaveConfig(): Promise<GatewayConfig> {
    const config: GatewayConfig = {
      host: "arweave.net",
      port: 443,
      protocol: "https",
    };
    return Promise.resolve(config);
  }

  /**
   * @deprecated Use signMessage() instead
   */
  public async signature(
    data: Uint8Array,
    algorithm?: AlgorithmIdentifier | RsaPssParams | EcdsaParams
  ): Promise<Uint8Array> {
    const dataString = data.toString();
    return this.createResponsePromise("signature", { data: dataString });
  }

  public async getActivePublicKey(): Promise<string> {
    return this.createResponsePromise("getActivePublicKey");
  }

  public async addToken(id: string): Promise<void> {
    return this.createResponsePromise("addToken", { data: id });
  }

  // Transaction Methods (Arweave/AO specific)
  /**
   * @deprecated Use signTransaction() instead
   */
  public async sign(transaction: Transaction): Promise<Transaction> {
    return this.createResponsePromise("sign", { transaction });
  }

  /**
   * @deprecated Use sendTransaction() instead
   */
  public async dispatch(transaction: Transaction): Promise<DispatchResult> {
    return this.createResponsePromise("dispatch", { transaction });
  }

  public async signDataItem(dataItem: DataItem): Promise<ArrayBuffer> {
    return this.createResponsePromise("signDataItem", { dataItem });
  }

  public async signMessage(message: string | Uint8Array, chain?: ChainType): Promise<string> {
    const messageData = typeof message === "string" ? message : message.toString();
    return this.createResponsePromise("signMessage", {
      message: messageData,
      ...(chain && { chain })
    });
  }

  public async signTransaction(transaction: any, chain?: ChainType): Promise<any> {
    return this.createResponsePromise("signTransaction", {
      transaction,
      ...(chain && { chain })
    });
  }

  public async sendTransaction(transaction: any, chain?: ChainType): Promise<string> {
    return this.createResponsePromise("sendTransaction", {
      transaction,
      ...(chain && { chain })
    });
  }

  /**
   * Sign EIP-712 typed data. Only works on Ethereum and Base chains.
   */
  public async signTypedData(params: TypedDataParams): Promise<string> {
    const activeChain = this.getActiveChain();
    if (activeChain !== "ethereum" && activeChain !== "base") {
      throw new Error(
        `signTypedData is only supported on EVM chains (ethereum, base). ` +
        `Current active chain: ${activeChain}`
      );
    }
    return this.createResponsePromise("signTypedData", params);
  }

  // Account Management Methods
  public async userTokens(
    options?: UserTokensOptions
  ): Promise<UserTokensResult> {
    return this.createResponsePromise("userTokens");
  }

  public async swapActiveWallet(walletAddress: string): Promise<string> {
    return this.createResponsePromise("swapActiveWallet", {
      data: walletAddress,
    });
  }

  public async getContacts(): Promise<Contact[]> {
    return this.createResponsePromise("getContacts");
  }

  // Utility Methods
  public async isAvailable(): Promise<boolean> {
    return this.connectionManager.getClient() !== null;
  }

  public isConnected(): boolean {
    return this.connectionManager.isClientConnected();
  }

  public getUid(): string | null {
    return this.connectionManager.getUid();
  }

  public hasActiveSession(): boolean {
    const hasTopicId = typeof sessionStorage !== "undefined" &&
                       !!sessionStorage.getItem("aosync-topic-id");
    const hasCache = this.messageHandler.getCache().hasActiveAddress();
    return hasTopicId && hasCache;
  }

  public getAccountType(): AccountType {
    return this.connectionManager.getAccountType();
  }

  public getSupportedChains(): ChainType[] {
    return this.connectionManager.getSupportedChains();
  }

  public getActiveChain(): ChainType {
    return this.connectionManager.getActiveChain();
  }

  public setActiveChain(chain: ChainType): void {
    const supportedChains = this.getSupportedChains();
    if (!supportedChains.includes(chain)) {
      throw new Error(
        `Chain "${chain}" is not supported for ${this.getAccountType()} account. ` +
        `Supported chains: ${supportedChains.join(", ")}`
      );
    }
    const previousChain = this.getActiveChain();
    this.messageHandler.getCache().setActiveChain(chain);

    if (previousChain !== chain) {
      this.eventEmitter.emit("chainChanged", {
        previousChain,
        currentChain: chain
      });
    }
  }

  public switchChain(chain: ChainType): void {
    this.setActiveChain(chain);
  }

  public async getMultiChainAddresses(): Promise<MultiChainWallet> {
    const cached = this.messageHandler.getCache().getMultiChainAddresses();
    if (cached) {
      return cached;
    }

    const chains = this.getSupportedChains();
    const addresses: MultiChainWallet = {};

    for (const chain of chains) {
      try {
        const address = await this.getActiveAddress(chain);
        addresses[chain] = address;
      } catch (error) {
        console.warn(`Failed to get address for chain ${chain}:`, error);
      }
    }

    this.messageHandler.getCache().setMultiChainAddresses(addresses);

    return addresses;
  }

  // Event Management
  public on(event: string, listener: (data: any) => void): void {
    this.eventEmitter.on(event, listener);
  }

  public off(event: string, listener: (data: any) => void): void {
    this.eventEmitter.off(event, listener);
  }

  // Internal Helper Methods (public for internal module access)
  public createResponsePromise<T>(action: string, payload: any = {}): Promise<T> {
    return this.requestCoordinator.createResponsePromise<T>(action, payload, {
      uid: this.connectionManager.getUid(),
      client: this.connectionManager.getClient(),
      publishMessage: this.connectionManager.publishMessage.bind(
        this.connectionManager
      ),
      createApprovalModal: () => this.modalManager.createApprovalModal(),
      autoSign: this.messageHandler.getAutoSign(),
      sessionActive: this.sessionActive,
      cache: this.messageHandler.getCache(),
    });
  }

  public populateWindowObject(): void {
    this.windowApiInjector.injectApi(this);
  }

  public async processPendingRequests(): Promise<void> {
    await this.requestCoordinator.processPendingRequests(this);
  }
}

export type { ChainType, AccountType, MultiChainWallet, TypedDataParams, Contact, Wallet } from "./types";
