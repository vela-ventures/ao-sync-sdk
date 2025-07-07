import mqtt, { IClientOptions, IPublishPacket, MqttClient } from "mqtt";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { Buffer } from "buffer";
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
import { connectionModalMessage, createModalTemplate } from "./templates";
import "./fonts";
import {
  ConnectionOptions,
  ModalStyles,
  ReconnectListenerData,
  ResponseListenerData,
  Wallet,
  WalletResponse,
} from "./types";
import { VERSION } from "./constants/version";

declare global {
  interface Window {
    __AOSYNC_VERSION__?: string;
  }
}

export default class WalletClient {
  private client: MqttClient | null;
  public uid: string | null;
  private qrCode: Promise<string> | null;
  private modal: HTMLDivElement | null;
  private approvalModal: HTMLDivElement | null;
  private responseListeners: Map<string, ResponseListenerData>;
  private connectionListener: ((response: any) => void) | null;
  private reconnectListener: ReconnectListenerData | null;
  private responseTimeoutMs: number;
  private txTimeoutMs: number;
  private eventListeners: Map<string, Set<(data: any) => void>>;
  private activeTimeouts: Set<NodeJS.Timeout>;
  private isConnected: boolean;
  private reconnectionTimeout: NodeJS.Timeout | null;
  private connectOptions: ConnectionOptions;
  private browserWalletBackup: Window["arweaveWallet"];
  private pendingRequests: Array<{
    method: string;
    args: any[];
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>;
  private isDarkMode: boolean;
  public sessionActive: boolean;
  private isAppleMobileDevice: boolean;
  private isInappBrowser: boolean;
  private autoSign: boolean;

  constructor(responseTimeoutMs = 30000, txTimeoutMs = 300000) {
    this.client = null;
    this.uid = null;
    this.qrCode = null;
    this.modal = null;
    this.approvalModal = null;
    this.responseListeners = new Map();
    this.connectionListener = null;
    this.reconnectListener = null;
    this.responseTimeoutMs = responseTimeoutMs;
    this.txTimeoutMs = txTimeoutMs;
    this.eventListeners = new Map();
    this.activeTimeouts = new Set();
    this.isConnected = false;
    this.reconnectionTimeout = null;
    this.connectOptions = null;
    this.autoSign = null;
    this.pendingRequests = [];
    this.isDarkMode =
      typeof window !== "undefined" &&
      window?.matchMedia &&
      window?.matchMedia("(prefers-color-scheme: dark)").matches;
    this.sessionActive =
      typeof window !== "undefined" &&
      !!sessionStorage.getItem("aosync-topic-id");
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "aosync-session-active",
        `${!!sessionStorage.getItem("aosync-topic-id")}`
      );
      const userAgent = window.navigator.userAgent;
      this.isAppleMobileDevice = /iPad|iPhone|iPod/.test(userAgent);
      this.isInappBrowser = !!window["beaconwallet"]?.version;
      window.__AOSYNC_VERSION__ = VERSION;
    }
  }

  private createModal(qrCodeData: string, styles?: ModalStyles): void {
    const modal = createModalTemplate({
      subTitle: "Scan with your beacon wallet",
      qrCodeData,
      description: "Don't have beacon yet?",
      walletClient: this,
    });
    this.modal = modal;
  }

  private createApprovalModal(): void {
    if (this.approvalModal) return;

    const modal = createModalTemplate({
      subTitle: "Approval pending ...",
      description: " ",
      animationData: true,
    });

    this.approvalModal = modal;
  }

  private async handleMQTTMessage(
    topic: string,
    message: Buffer,
    packet: IPublishPacket
  ): Promise<void> {
    const responseChannel = `${this.uid}/response`;
    if (topic !== responseChannel) return;

    const messageData = JSON.parse(message.toString()) as WalletResponse;

    if (messageData.action === "connect") {
      connectionModalMessage("success");
      if (this.modal) {
        this.modal = null;
      }
      await this.handleConnectResponse(packet);
      sessionStorage.setItem("aosync-topic-id", this.uid);
      return;
    }

    if (messageData.action === "disconnect") {
      await this.handleDisconnectResponse("Beacon wallet initiated disconnect");
      return;
    }

    if (
      packet?.properties.correlationData.toString() ==
      this.reconnectListener?.corellationId
    ) {
      clearTimeout(this.reconnectionTimeout);
      this.processPendingRequests();
      this.isConnected = true;
      this.reconnectListener = null;
      this.populateWindowObject();
      this.emit("connected", { status: "connected successfully" });
    }

    const correlationId = packet?.properties?.correlationData?.toString();
    if (correlationId && this.responseListeners.has(correlationId)) {
      const listenerData = this.responseListeners.get(correlationId)!;
      const isTransaction = ["sign", "dispatch", "signDataItem"].includes(
        listenerData.action
      );
      if (listenerData.action === "signDataItem") {
        const decodedData = this.base64UrlDecode(messageData.data);
        listenerData.resolve(decodedData);
      } else {
        listenerData.resolve(messageData.data);
      }

      if (isTransaction) {
        if (messageData.data === "declined") {
          connectionModalMessage("fail");
          if (this.approvalModal) {
            this.approvalModal = null;
          }
        } else {
          connectionModalMessage("success");
          if (this.approvalModal) {
            this.approvalModal = null;
          }
        }
      }
      this.responseListeners.delete(correlationId);
    }
  }

  private base64UrlDecode(base64Url: string) {
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const decodedString = atob(paddedBase64);
    const byteArray = new Uint8Array(decodedString.length);
    for (let i = 0; i < decodedString.length; i++) {
      byteArray[i] = decodedString.charCodeAt(i);
    }
    return byteArray;
  }

  private async handleConnectResponse(packet: IPublishPacket): Promise<void> {
    this.isConnected = true;
    this.populateWindowObject();
    if (this.connectionListener) {
      this.connectionListener("connected");
    }
    const topic = this.uid;
    const message = {
      appInfo: {
        name: this.connectOptions.appInfo?.name || "unknown",
        url: "unknown",
        logo: this.connectOptions.appInfo?.logo || "unknown",
      },
      permissions: this.connectOptions.permissions,
      gateway: this.connectOptions.gateway,
    };
    const publishOptions = packet?.properties?.correlationData
      ? { properties: { correlationData: packet.properties.correlationData } }
      : {};

    if (Buffer.isBuffer(packet.payload)) {
      const bufferString = packet.payload.toString("utf8");
      try {
        const bufferJson = JSON.parse(bufferString);
        this.autoSign = bufferJson.connectionOptions?.autoSign;
      } catch {
        console.log("Buffer content is not JSON");
      }
    }

    if (topic) {
      await this.publishMessage(topic, message, publishOptions);
    }
    this.emit("connected", { status: "connected successfully" });
  }

  private async handleDisconnectResponse(reason: string): Promise<void> {
    this.isConnected = false;
    this.approvalModal = null;
    this.emit("disconnected", { reason });
    const modal = createModalTemplate({
      subTitle: "Beacon wallet disconnected",
      description: " ",
      autoClose: true,
    });
    await this.disconnect();
  }

  private async publishMessage(
    topic: string,
    message: any,
    options: mqtt.IClientPublishOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client?.publish(topic, JSON.stringify(message), options, (err) =>
        err ? reject(err) : resolve()
      );
    });
  }

  private createResponsePromise<T>(
    action: string,
    payload: any = {}
  ): Promise<T> {
    if (sessionStorage.getItem("aosync-topic-id") && !this.client) {
      return new Promise((resolve, reject) => {
        this.pendingRequests.push({
          method: action,
          args: [payload],
          resolve,
          reject,
        });
      });
    }

    if (!sessionStorage.getItem("aosync-topic-id") && !this.client) {
      this.isConnected = false;
      this.approvalModal = null;
      this.emit("disconnected", { reson: "AOsync connection not found" });
      if (this.browserWalletBackup) {
        window.arweaveWallet = this.browserWalletBackup;
      }
      return;
    }

    const correlationData = uuidv4();
    const topic = this.uid;

    const isTransaction = ["sign", "dispatch", "signDataItem"].includes(action);
    const timeoutDuration = isTransaction
      ? this.txTimeoutMs
      : this.responseTimeoutMs;

    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error(`Not connected to AOSync`));
        return;
      }

      this.responseListeners.set(correlationData, {
        action,
        resolve,
      });

      if (topic) {
        this.publishMessage(
          topic,
          { action, correlationData, ...payload },
          {
            properties: {
              correlationData: Buffer.from(correlationData, "utf-8"),
            },
          }
        ).catch((err) => {
          this.responseListeners.delete(correlationData);
          reject(err);
        });
      }

      if (isTransaction) {
        if (this.autoSign) {
          const actionTag = payload.dataItem.tags.find(
            (tag) => tag.name === "Action"
          );
          if (actionTag?.value === "Transfer") {
            this.createApprovalModal();
          }
        } else {
          this.createApprovalModal();
        }
      }

      const timeout = setTimeout(() => {
        if (this.responseListeners.has(correlationData)) {
          this.responseListeners.delete(correlationData);
          reject(new Error(`${action} timeout`));
        }
        if (isTransaction) {
          if (document.getElementById("aosync-modal")) {
            connectionModalMessage("fail");
          }
        }
        this.activeTimeouts.delete(timeout);
      }, timeoutDuration);

      this.activeTimeouts.add(timeout);
    });
  }

  private clearAllTimeouts(): void {
    this.activeTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.activeTimeouts.clear();
  }

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
  }: {
    permissions?: PermissionType[];
    appInfo?: AppInfo;
    gateway?: GatewayConfig;
    brokerUrl?: string;
    options?: IClientOptions;
  }): Promise<void> {
    if (this.isConnected) return;
    if (this.client) {
      const qrCodeData = await QRCode.toDataURL("aosync=" + this.uid);
      this.createModal(qrCodeData);
      console.warn("Already connected to the broker.");
      return;
    }

    if (this.isAppleMobileDevice && !this.isInappBrowser) {
      window.open(`beaconwallet://aosync?websiteURL=${window.location.href}`);
      return;
    }

    this.uid = uuidv4();

    this.client = mqtt.connect(brokerUrl, options);
    this.sessionActive = true;
    sessionStorage.setItem("aosync-session-active", "true");
    window.dispatchEvent(
      new CustomEvent("aosync-session-change", {
        detail: { isActive: true },
      })
    );

    const responseChannel = `${this.uid}/response`;
    let qrCodeOptions = {};
    if (this.isDarkMode) {
      qrCodeOptions = {
        color: { dark: "#FFFFFF", light: "#0A0B19" },
      };
    } else {
      qrCodeOptions = {
        color: { dark: "#0A0B19", light: "#FFFFFF" },
      };
    }
    const qrCodeData = await QRCode.toDataURL(
      "aosync=" + this.uid,
      qrCodeOptions
    );

    if (!this.isAppleMobileDevice && !this.isInappBrowser) {
      this.createModal(qrCodeData);
    }

    this.connectOptions = {
      permissions,
      appInfo,
      gateway,
    };
    return new Promise((resolve, reject) => {
      this.connectionListener = (response) => {
        if (response === "connection_canceled") {
          if (this.client) {
            this.client.end(false, () => {
              this.client = null;
            });
          }
          reject(new Error("Connection canceled by user"));
          return;
        }
        resolve(response);
      };
      this.client!.on("connect", async () => {
        try {
          await new Promise<void>((res, rej) => {
            this.client!.subscribe(responseChannel, (err) => {
              err ? rej(err) : res();
            });
          });

          if (this.isAppleMobileDevice && this.isInappBrowser) {
            window["beaconwallet"]?.connect(this.uid);
          }

          this.client!.on("message", this.handleMQTTMessage.bind(this));
        } catch (err) {
          reject(err);
        }
      });

      this.client!.on("error", reject);
    });
  }

  public async reconnect(
    brokerUrl = "wss://aosync-broker-eu.beaconwallet.dev:8081",
    options: IClientOptions = {
      protocolVersion: 5,
    }
  ): Promise<void> {
    if (this.reconnectListener != null) return;

    const sessionStorageTopicId = sessionStorage.getItem("aosync-topic-id");
    if (sessionStorageTopicId === null) return;

    try {
      this.uid = sessionStorageTopicId;
      this.populateWindowObject();
      const responseChannel = `${this.uid}/response`;

      if (this.client) {
        return new Promise((resolve, reject) => {
          try {
            const correlationData = uuidv4();
            this.reconnectListener = {
              corellationId: correlationData,
              resolve,
            };

            this.reconnectionTimeout = setTimeout(async () => {
              if (this.isConnected) return;
              console.warn("No response received during reconnection attempt");
              clearTimeout(this.reconnectionTimeout);
              try {
                await this.disconnect();
              } catch (err) {
                reject(err);
                return;
              }
              reject(new Error("Reconnection timeout"));
            }, 3000);

            this.publishMessage(
              this.uid,
              { action: "getActiveAddress", correlationData: correlationData },
              {
                properties: {
                  correlationData: Buffer.from(correlationData, "utf-8"),
                },
              }
            );
          } catch (err) {
            reject(err);
          }
        });
      }

      this.client = mqtt.connect(brokerUrl, options);
      return new Promise((resolve, reject) => {
        this.client!.on("connect", async () => {
          try {
            const correlationData = uuidv4();
            this.reconnectListener = {
              corellationId: correlationData,
              resolve,
            };
            await new Promise<void>((res, rej) => {
              this.client!.subscribe(responseChannel, (err) => {
                err ? rej(err) : res();
              });
            });

            this.reconnectionTimeout = setTimeout(async () => {
              console.warn("No response received during reconnection attempt");
              clearTimeout(this.reconnectionTimeout);
              try {
                await this.disconnect();
              } catch (err) {
                reject(err);
                return;
              }
              reject(new Error("Reconnection timeout"));
            }, 3000);

            this.publishMessage(
              this.uid,
              { action: "getActiveAddress", correlationData: correlationData },
              {
                properties: {
                  correlationData: Buffer.from(correlationData, "utf-8"),
                },
              }
            );

            this.client!.on("message", this.handleMQTTMessage.bind(this));
          } catch (err) {
            reject(err);
          }
        });

        this.client!.on("error", reject);
      });
    } catch (error) {
      this.pendingRequests.forEach((request) => {
        request.reject(new Error("Reconnection failed"));
      });
      this.pendingRequests = [];
      this.disconnect();
      throw error;
    }
  }

  private async processPendingRequests(): Promise<void> {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    for (const request of requests) {
      try {
        const result = await this[request.method](...request.args);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.browserWalletBackup) {
      window.arweaveWallet = this.browserWalletBackup;
    }

    if (sessionStorage.getItem("aosync-topic-id")) {
      sessionStorage.removeItem("aosync-topic-id");
      this.sessionActive = false;
      sessionStorage.removeItem("aosync-session-active");
      window.dispatchEvent(
        new CustomEvent("aosync-session-change", {
          detail: { isActive: false },
        })
      );
    }

    if (!this.client) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (this.uid) {
        this.client!.publish(
          this.uid,
          JSON.stringify({ action: "disconnect" }),
          {},
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            this.client!.end(false, () => {
              this.client = null;

              this.responseListeners.forEach((listener) =>
                listener.resolve(
                  new Error("Disconnected before response was received")
                )
              );
              this.handleDisconnectResponse("disconnected from wallet");
              this.responseListeners.clear();

              this.clearAllTimeouts();
              resolve();
            });

            this.client!.on("error", reject);
          }
        );
      }
    });
  }

  public async getActiveAddress(): Promise<string> {
    return this.createResponsePromise("getActiveAddress");
  }

  public async getAllAddresses(): Promise<string[]> {
    return this.createResponsePromise("getAllAddresses");
  }

  public async getPermissions(): Promise<PermissionType[]> {
    if (!this.client) {
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

  public async sign(transaction: Transaction): Promise<Transaction> {
    return this.createResponsePromise("sign", { transaction });
  }

  public async dispatch(transaction: Transaction): Promise<DispatchResult> {
    return this.createResponsePromise("dispatch", { transaction });
  }

  public async signDataItem(dataItem: DataItem): Promise<ArrayBuffer> {
    return this.createResponsePromise("signDataItem", { dataItem });
  }

  public async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  public on(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  public off(event: string, listener: (data: any) => void): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  private emit(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach((listener) => listener(data));
    }
  }

  public async userTokens(
    options?: UserTokensOptions
  ): Promise<UserTokensResult> {
    return this.createResponsePromise("userTokens");
  }

  public async swapActiveWallet(walletAddress: string): Promise<string> {
    return this.createResponsePromise("swapActiveWallet", { data: walletAddress });
  }

  private populateWindowObject() {
    if (typeof window !== "undefined") {
      if (window?.arweaveWallet?.walletName === "AOSync") return;
      const createMethodWrapper = (method: Function) => {
        return async (...args: any[]) => {
          if (!this.isConnected) {
            throw new Error(
              "Wallet is not connected. Please call connect() first."
            );
          }
          return method.apply(this, args);
        };
      };

      const walletApi: any = {
        walletName: "AOSync",
        aosyncVersion: VERSION,
        connect: async (
          permissions: PermissionType[],
          appInfo?: AppInfo,
          gateway?: GatewayConfig
        ) => {
          await this.connect({ permissions, appInfo, gateway });
        },
        disconnect: this.disconnect.bind(this),
        getActiveAddress: createMethodWrapper(this.getActiveAddress),
        getAllAddresses: createMethodWrapper(this.getAllAddresses),
        getPermissions: createMethodWrapper(this.getPermissions),
        getWalletNames: createMethodWrapper(this.getWalletNames),
        encrypt: createMethodWrapper(this.encrypt),
        decrypt: createMethodWrapper(this.decrypt),
        getArweaveConfig: createMethodWrapper(this.getArweaveConfig),
        signature: createMethodWrapper(this.signature),
        getActivePublicKey: createMethodWrapper(this.getActivePublicKey),
        addToken: createMethodWrapper(this.addToken),
        sign: createMethodWrapper(this.sign),
        dispatch: createMethodWrapper(this.dispatch),
        signDataItem: createMethodWrapper(this.signDataItem),
        userTokens: createMethodWrapper(this.userTokens),
      };

      if (window.arweaveWallet) {
        this.browserWalletBackup = window.arweaveWallet;
      }

      window.arweaveWallet = walletApi;
    }
  }
}
