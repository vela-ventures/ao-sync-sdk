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
} from "arconnect";
import PaperplaneAnimation from "../public/assets/paperplane.json";
import { connectionModalMessage, createModalTemplate } from "./templates";
import "./fonts";
import {
  ConnectionOptions,
  ModalStyles,
  ReconnectListenerData,
  ResponseListenerData,
  WalletResponse,
} from "./types";

export default class WalletClient {
  private client: MqttClient | null;
  private uid: string | null;
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
  }

  private createModal(qrCodeData: string, styles?: ModalStyles): void {
    const modal = createModalTemplate({
      subTitle: "Scan with your beacon wallet",
      qrCodeData,
      description: "Don't have beacon yet?",
    });
    this.modal = modal;
  }

  private createApprovalModal(): void {
    if (this.approvalModal) return;

    const modal = createModalTemplate({
      subTitle: "Approval pending ...",
      description: " ",
      animationData: PaperplaneAnimation,
    });

    this.approvalModal = modal;
  }

  private createCloseButton(): HTMLButtonElement {
    const button = document.createElement("button");
    Object.assign(button, {
      textContent: "Close",
      onclick: () => this.closeModal(),
      style: {
        marginTop: "20px",
        padding: "10px 20px",
        border: "none",
        backgroundColor: "#007BFF",
        color: "#fff",
        borderRadius: "4px",
        cursor: "pointer",
      },
    });
    return button;
  }

  private connectionModalSuccessMessage(): void {
    const qrCode = document.getElementById("aosync-beacon-connection-qrCode");

    const modalDescription = document.getElementById(
      "aosync-beacon-modal-description"
    );
    const successMark = document.createElement("div");
    Object.assign(successMark.style, {
      width: "200px",
      height: "200px",
      marginBottom: "10px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: "30px",
      boxSizing: "border-box",
    });
    if (modalDescription) {
      modalDescription!.style.visibility = "hidden";
    }
    successMark.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="79" height="57" viewBox="0 0 79 57" fill="none">
      <path d="M26.9098 57L0 30.221L5.18687 25.0593L26.9098 46.7012L73.8391 0L79 5.16166L26.9098 57Z" fill="#27BD69"/>
    </svg>
    `;
    qrCode?.replaceWith(successMark);

    setTimeout(() => {
      this.closeModal();
    }, 1000);
  }

  private closeModal(): void {
    if (this.modal) {
      document.body.removeChild(this.modal);
      this.modal = null;
    }
  }

  private closeApprovalModal(): void {
    if (this.approvalModal) {
      document.body.removeChild(this.approvalModal);
      this.approvalModal = null;
    }
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
      this.reconnectListener = null;
      this.emit("connected", { status: "connected successfully" });
      this.isConnected = true;
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
    if (this.connectionListener) {
      this.connectionListener("connected");
    }
    const topic = this.uid;
    const message = {
      appInfo: {
        name: this.connectOptions.appInfo?.name || "unknown",
        url: "https://beaconwallet.app/",
        logo: this.connectOptions.appInfo?.logo || "unknown",
      },
      permissions: ["transactions", "view address", "balance"],
    };

    const publishOptions = packet?.properties?.correlationData
      ? { properties: { correlationData: packet.properties.correlationData } }
      : {};

    if (topic) {
      await this.publishMessage(topic, message, publishOptions);
    }

    this.isConnected = true;
    this.emit("connected", { status: "connected successfully" });
  }

  private async handleDisconnectResponse(reason: string): Promise<void> {
    this.isConnected = false;
    this.emit("disconnected", { reason });
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
    const correlationData = uuidv4();
    const topic = this.uid;

    const isTransaction = ["sign", "dispatch", "signDataItem"].includes(action);
    const timeoutDuration = isTransaction
      ? this.txTimeoutMs
      : this.responseTimeoutMs;

    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error("Not connected to MQTT broker"));
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
        this.createApprovalModal();
      }

      const timeout = setTimeout(() => {
        if (this.responseListeners.has(correlationData)) {
          this.responseListeners.delete(correlationData);
          reject(new Error(`${action} timeout`));
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
    permissions,
    appInfo,
    gateway,
    brokerUrl = "wss://broker.beaconwallet.dev:8081",
    options = { protocolVersion: 5 },
  }: {
    permissions?: PermissionType[];
    appInfo?: AppInfo;
    gateway?: GatewayConfig;
    brokerUrl?: string;
    options?: IClientOptions;
  }): Promise<void> {
    if (this.client) {
      const qrCodeData = await QRCode.toDataURL("aosync=" + this.uid);
      this.createModal(qrCodeData);
      console.warn("Already connected to the broker.");
      return;
    }

    this.client = mqtt.connect(brokerUrl, options);
    this.uid = uuidv4();
    const responseChannel = `${this.uid}/response`;
    const qrCodeData = await QRCode.toDataURL("aosync=" + this.uid);
    this.createModal(qrCodeData);

    this.connectOptions = {
      permissions,
      appInfo,
      gateway,
    };
    return new Promise((resolve, reject) => {
      this.connectionListener = resolve;
      this.client!.on("connect", async () => {
        try {
          console.log("connected broker subing to " + responseChannel);
          await new Promise<void>((res, rej) => {
            this.client!.subscribe(responseChannel, (err) => {
              err ? rej(err) : res();
            });
          });

          this.client!.on("message", this.handleMQTTMessage.bind(this));
        } catch (err) {
          reject(err);
        }
      });

      this.client!.on("error", reject);
    });
  }

  public async reconnect(
    brokerUrl = "wss://broker.beaconwallet.dev:8081",
    options: IClientOptions = {
      protocolVersion: 5,
    }
  ): Promise<void> {
    if (this.reconnectListener != null) return;

    const sessionStorageTopicId = sessionStorage.getItem("aosync-topic-id");
    if (sessionStorageTopicId === null) return;
    this.uid = sessionStorageTopicId;
    const responseChannel = `${this.uid}/response`;

    if (this.client) {
      return new Promise((resolve, reject) => {
        try {
          const correlationData = uuidv4();
          console.log("corellationData created " + correlationData);
          this.reconnectListener = { corellationId: correlationData, resolve };

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
          console.log("corellationData created " + correlationData);
          this.reconnectListener = { corellationId: correlationData, resolve };
          console.log("connected broker subing to " + responseChannel);
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
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      console.warn("No active MQTT connection to disconnect.");
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
              sessionStorage.removeItem("aosync-topic-id");
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
    return this.createResponsePromise("getPermissions");
  }

  public async getWalletNames(): Promise<{ [addr: string]: string }> {
    return this.createResponsePromise("getWalletNames");
  }

  public async encrypt(
    data: BufferSource,
    algorithm: RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams
  ): Promise<Uint8Array> {
    return this.createResponsePromise("encrypt", { data, algorithm });
  }

  public async decrypt(
    data: BufferSource,
    algorithm: RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams
  ): Promise<Uint8Array> {
    return this.createResponsePromise("decrypt", { data, algorithm });
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
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams
  ): Promise<Uint8Array> {
    const dataString = data.toString();
    return this.createResponsePromise("signature", { data: dataString });
  }

  public async getActivePublicKey(): Promise<string> {
    return this.createResponsePromise("getActivePublicKey");
  }

  public async addToken(id: string): Promise<void> {
    return this.createResponsePromise("addToken");
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
}
