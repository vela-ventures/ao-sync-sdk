import { Buffer } from "buffer";
import { IPublishPacket } from "mqtt";
import { WalletResponse, ReconnectListenerData, ConnectionOptions } from "../types";
import { connectionModalMessage, createModalTemplate } from "../templates";
import { isVersionValid, base64UrlDecode } from "../utils/helpers";
import { BEACON_MIN_VERSION } from "../constants/beacon-version";
import { RequestCoordinator } from "./RequestCoordinator";
import { ModalManager } from "./ModalManager";
import { EventEmitter } from "./EventEmitter";
import { SessionStorageCache } from "../utils/cache";

export class MessageHandler {
  private autoSign: boolean | null;
  private reconnectListener: ReconnectListenerData | null;
  private reconnectionTimeout: NodeJS.Timeout | null;
  private cache: SessionStorageCache;

  constructor(
    private requestCoordinator: RequestCoordinator,
    private modalManager: ModalManager,
    private eventEmitter: EventEmitter
  ) {
    this.autoSign = null;
    this.reconnectListener = null;
    this.reconnectionTimeout = null;
    this.cache = new SessionStorageCache();
  }

  public async handleMQTTMessage(
    topic: string,
    message: Buffer,
    packet: IPublishPacket,
    context: {
      uid: string | null;
      isConnected: boolean;
      connectOptions: ConnectionOptions;
      publishMessage: (topic: string, message: any, options?: any) => Promise<void>;
      populateWindowObject: () => void;
      disconnect: () => Promise<void>;
      setConnected: (value: boolean) => void;
      processPendingRequests: () => Promise<void>;
    }
  ): Promise<void> {
    const responseChannel = `${context.uid}/response`;
    if (topic !== responseChannel) return;

    const messageData = JSON.parse(message.toString()) as WalletResponse;

    if (messageData.action === "connect") {
      await this.handleConnectResponse(packet, context);
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("aosync-topic-id", context.uid);
      }
      return;
    }

    if (messageData.action === "disconnect") {
      await this.handleDisconnectResponse("Beacon wallet initiated disconnect", context);
      return;
    }

    if (
      packet?.properties.correlationData.toString() ==
      this.reconnectListener?.corellationId
    ) {
      clearTimeout(this.reconnectionTimeout);

      // Cache the wallet address from reconnect response
      if (messageData.data && typeof messageData.data === 'string') {
        this.cache.setActiveAddress(messageData.data);
      }

      await context.processPendingRequests();
      context.setConnected(true);
      this.reconnectListener = null;
      context.populateWindowObject();
      this.eventEmitter.emit("connected", { status: "connected successfully" });
    }

    const correlationId = packet?.properties?.correlationData?.toString();
    const responseListeners = this.requestCoordinator.getResponseListeners();
    if (correlationId && responseListeners.has(correlationId)) {
      const listenerData = responseListeners.get(correlationId)!;
      const isTransaction = ["sign", "dispatch", "signDataItem"].includes(
        listenerData.action
      );

      // Cache wallet data responses for offline access
      const isCacheableQuery = [
        "getActiveAddress",
        "getAllAddresses",
        "getWalletNames",
        "getPermissions"
      ].includes(listenerData.action);

      if (listenerData.action === "getActiveAddress" && typeof messageData.data === 'string') {
        this.cache.setActiveAddress(messageData.data);
      } else if (listenerData.action === "getAllAddresses" && Array.isArray(messageData.data)) {
        this.cache.setAllAddresses(messageData.data);
      } else if (listenerData.action === "getWalletNames" && typeof messageData.data === 'object') {
        this.cache.setWalletNames(messageData.data);
      } else if (listenerData.action === "getPermissions" && Array.isArray(messageData.data)) {
        this.cache.setPermissions(messageData.data);
      }

      if (isCacheableQuery) {
        this.eventEmitter.emit("cacheUpdated", {
          action: listenerData.action,
          data: messageData.data
        });
      }

      if (listenerData.action === "signDataItem") {
        const decodedData = base64UrlDecode(messageData.data);
        listenerData.resolve(decodedData);
      } else {
        listenerData.resolve(messageData.data);
      }

      if (isTransaction) {
        if (messageData.data === "declined") {
          connectionModalMessage("fail");
          this.modalManager.setApprovalModal(null);
        } else {
          connectionModalMessage("success");
          this.modalManager.setApprovalModal(null);
        }
      }
      responseListeners.delete(correlationId);
    }
  }

  private async handleConnectResponse(
    packet: IPublishPacket,
    context: {
      uid: string | null;
      connectOptions: ConnectionOptions;
      publishMessage: (topic: string, message: any, options?: any) => Promise<void>;
      populateWindowObject: () => void;
      setConnected: (value: boolean) => void;
    }
  ): Promise<void> {
    if (Buffer.isBuffer(packet.payload)) {
      const bufferString = packet.payload.toString("utf8");
      try {
        const bufferJson = JSON.parse(bufferString);
        this.autoSign = bufferJson.connectionOptions?.autoSign;

        const clientVersion = bufferJson.connectionOptions?.version;
        if (!isVersionValid(clientVersion, BEACON_MIN_VERSION)) {
          createModalTemplate({
            subTitle: `Warning`,
            description: `The minimum supported version is ${BEACON_MIN_VERSION}, and some features may not work as expected. Please update to the latest version of the app for the best experience.`,
            animationData: false,
          });
        }
      } catch {
        console.log("Buffer content is not JSON");
      }
    }

    if (typeof document !== "undefined") {
      const qrCode = document.getElementById("aosync-beacon-connection-qrCode");
      if (qrCode) {
        connectionModalMessage("success");
        this.modalManager.closeConnectionModal();
      }
    }

    context.setConnected(true);
    context.populateWindowObject();
    const topic = context.uid;
    const message = {
      appInfo: {
        name: context.connectOptions.appInfo?.name || "unknown",
        url: "unknown",
        logo: context.connectOptions.appInfo?.logo || "unknown",
      },
      permissions: context.connectOptions.permissions,
      gateway: context.connectOptions.gateway,
    };
    const publishOptions = packet?.properties?.correlationData
      ? { properties: { correlationData: packet.properties.correlationData } }
      : {};

    if (topic) {
      await context.publishMessage(topic, message, publishOptions);
    }
    this.eventEmitter.emit("connected", { status: "connected successfully" });
  }

  private async handleDisconnectResponse(
    reason: string,
    context: {
      disconnect: () => Promise<void>;
      setConnected: (value: boolean) => void;
    }
  ): Promise<void> {
    context.setConnected(false);
    this.modalManager.setApprovalModal(null);
    this.eventEmitter.emit("disconnected", { reason });
    const modal = createModalTemplate({
      subTitle: "Beacon wallet disconnected",
      description: " ",
      autoClose: true,
    });
    await context.disconnect();
  }

  public setReconnectListener(listener: ReconnectListenerData | null): void {
    this.reconnectListener = listener;
  }

  public getReconnectListener(): ReconnectListenerData | null {
    return this.reconnectListener;
  }

  public setReconnectionTimeout(timeout: NodeJS.Timeout | null): void {
    this.reconnectionTimeout = timeout;
  }

  public getReconnectionTimeout(): NodeJS.Timeout | null {
    return this.reconnectionTimeout;
  }

  public getAutoSign(): boolean | null {
    return this.autoSign;
  }

  public getCache(): SessionStorageCache {
    return this.cache;
  }
}
