import mqtt, { IClientOptions, MqttClient } from "mqtt";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { Buffer } from "buffer";
import type { PermissionType, GatewayConfig, AppInfo } from "arconnect";
import {
  ConnectionOptions,
  AccountType,
  ChainType,
} from "../types";
import { ModalManager } from "./ModalManager";
import { MessageHandler } from "./MessageHandler";
import { RequestCoordinator } from "./RequestCoordinator";

export class MqttConnectionManager {
  private client: MqttClient | null;
  private uid: string | null;
  private connectOptions: ConnectionOptions;
  private isConnected: boolean;
  private connectionListener: ((response: any) => void) | null;
  private sessionActive: boolean;

  constructor(
    private modalManager: ModalManager,
    private messageHandler: MessageHandler,
    private requestCoordinator: RequestCoordinator,
    private isDarkMode: boolean,
    private isAppleMobileDevice: boolean,
    private isInappBrowser: boolean
  ) {
    this.client = null;
    this.uid = null;
    this.connectOptions = null;
    this.isConnected = false;
    this.connectionListener = null;
    this.sessionActive =
      typeof window !== "undefined" &&
      typeof sessionStorage !== "undefined" &&
      !!sessionStorage.getItem("aosync-topic-id");
  }

  private getQRCodeOptions() {
    if (this.isDarkMode) {
      return {
        color: { dark: "#FFFFFF", light: "#0a0a0a" },
      };
    }
    return {
      color: { dark: "#0A0B19", light: "#FFFFFF" },
    };
  }

  public async connect(
    {
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
    },
    walletClient: any
  ): Promise<void> {
    if (this.isConnected) return;
    if (this.client) {
      const qrCodeData = await QRCode.toDataURL(
        "aosync=" + this.uid,
        this.getQRCodeOptions()
      );
      this.modalManager.createConnectionModal(qrCodeData, walletClient);
      console.warn("Already connected to the broker.");
      return;
    }

    if (this.isAppleMobileDevice && !this.isInappBrowser) {
      if (typeof window !== "undefined") {
        window.open(`beaconwallet://aosync?websiteURL=${window.location.href}`);
      }
      return;
    }

    this.uid = uuidv4();

    this.client = mqtt.connect(brokerUrl, options);
    this.sessionActive = true;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("aosync-session-active", "true");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("aosync-session-change", {
          detail: { isActive: true },
        })
      );
    }

    const responseChannel = `${this.uid}/response`;

    const qrData = {
      v: 1,
      uid: this.uid,
      accountType,
    };

    const qrCodeData = await QRCode.toDataURL(
      "aosync=" + btoa(JSON.stringify(qrData)),
      this.getQRCodeOptions()
    );

    if (!this.isAppleMobileDevice && !this.isInappBrowser) {
      this.modalManager.createConnectionModal(qrCodeData, walletClient);
    }

    this.connectOptions = {
      permissions,
      appInfo,
      gateway,
      accountType,
    };

    const cache = this.messageHandler.getCache();
    cache.setConnectOptions(this.connectOptions);
    cache.setAccountType(accountType);

    const defaultChain = accountType === "multichain" ? "ethereum" : "arweave";
    cache.setActiveChain(defaultChain);

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
            if (typeof window !== "undefined" && window["beaconwallet"]) {
              window["beaconwallet"]?.connect(this.uid);
            }
          }

          this.client!.on("message", (topic, message, packet) =>
            this.messageHandler.handleMQTTMessage(topic, message, packet, {
              uid: this.uid,
              isConnected: this.isConnected,
              connectOptions: this.connectOptions,
              publishMessage: this.publishMessage.bind(this),
              populateWindowObject: () => walletClient.populateWindowObject(),
              disconnect: async () => walletClient.disconnect(),
              setConnected: (value: boolean) => {
                this.isConnected = value;
              },
              processPendingRequests: async () =>
                walletClient.processPendingRequests(),
            })
          );
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
    },
    walletClient: any
  ): Promise<void> {
    if (this.messageHandler.getReconnectListener() != null) return;

    const sessionStorageTopicId =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("aosync-topic-id")
        : null;
    if (sessionStorageTopicId === null) return;

    try {
      this.uid = sessionStorageTopicId;
      const responseChannel = `${this.uid}/response`;

      // Restore cached connect options
      const cache = this.messageHandler.getCache();
      const cachedConnectOptions = cache.getConnectOptions();
      if (cachedConnectOptions) {
        this.connectOptions = cachedConnectOptions;
      }

      // Check if we have cached address - if so, connect immediately
      const hasCachedAddress = cache.hasActiveAddress();

      if (this.client) {
        // If we have cached data, resolve immediately and refresh in background
        if (hasCachedAddress) {
          this.isConnected = true;
          walletClient.populateWindowObject();
          this.modalManager.closeConnectionModal();

          // Send background request to refresh data (no await, fire and forget)
          const correlationData = uuidv4();
          this.publishMessage(
            this.uid,
            { action: "getActiveAddress", correlationData: correlationData },
            {
              properties: {
                correlationData: Buffer.from(correlationData, "utf-8"),
              },
            }
          ).catch((err) => console.warn("Background refresh failed:", err));

          return Promise.resolve();
        }

        // No cached data - use original timeout-based approach
        return new Promise((resolve, reject) => {
          try {
            const correlationData = uuidv4();
            this.messageHandler.setReconnectListener({
              corellationId: correlationData,
              resolve,
            });

            const timeout = setTimeout(async () => {
              if (this.isConnected) return;
              console.warn("No response received during reconnection attempt");
              clearTimeout(timeout);
              try {
                await this.disconnect(walletClient);
              } catch (err) {
                reject(err);
                return;
              }
              reject(new Error("Reconnection timeout"));
            }, 3000);

            this.messageHandler.setReconnectionTimeout(timeout);

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

      // If we have cached data, resolve immediately after connecting to broker
      if (hasCachedAddress) {
        return new Promise((resolve, reject) => {
          this.client!.on("connect", async () => {
            try {
              await new Promise<void>((res, rej) => {
                this.client!.subscribe(responseChannel, (err) => {
                  err ? rej(err) : res();
                });
              });

              this.isConnected = true;
              walletClient.populateWindowObject();
              this.modalManager.closeConnectionModal();

              // Setup message handler for future messages
              this.client!.on("message", (topic, message, packet) =>
                this.messageHandler.handleMQTTMessage(topic, message, packet, {
                  uid: this.uid,
                  isConnected: this.isConnected,
                  connectOptions: this.connectOptions,
                  publishMessage: this.publishMessage.bind(this),
                  populateWindowObject: () =>
                    walletClient.populateWindowObject(),
                  disconnect: async () => walletClient.disconnect(),
                  setConnected: (value: boolean) => {
                    this.isConnected = value;
                  },
                  processPendingRequests: async () =>
                    walletClient.processPendingRequests(),
                })
              );

              // Send background refresh request (fire and forget)
              const correlationData = uuidv4();
              this.publishMessage(
                this.uid,
                {
                  action: "getActiveAddress",
                  correlationData: correlationData,
                },
                {
                  properties: {
                    correlationData: Buffer.from(correlationData, "utf-8"),
                  },
                }
              ).catch((err) => console.warn("Background refresh failed:", err));

              resolve();
            } catch (err) {
              reject(err);
            }
          });

          this.client!.on("error", reject);
        });
      }

      // No cached data - use original timeout-based approach)
      return new Promise((resolve, reject) => {
        this.client!.on("connect", async () => {
          try {
            const correlationData = uuidv4();
            this.messageHandler.setReconnectListener({
              corellationId: correlationData,
              resolve,
            });
            await new Promise<void>((res, rej) => {
              this.client!.subscribe(responseChannel, (err) => {
                err ? rej(err) : res();
              });
            });

            const timeout = setTimeout(async () => {
              console.warn("No response received during reconnection attempt");
              clearTimeout(timeout);
              try {
                await this.disconnect(walletClient);
              } catch (err) {
                reject(err);
                return;
              }
              reject(new Error("Reconnection timeout"));
            }, 3000);

            this.messageHandler.setReconnectionTimeout(timeout);

            this.publishMessage(
              this.uid,
              { action: "getActiveAddress", correlationData: correlationData },
              {
                properties: {
                  correlationData: Buffer.from(correlationData, "utf-8"),
                },
              }
            );

            this.client!.on("message", (topic, message, packet) =>
              this.messageHandler.handleMQTTMessage(topic, message, packet, {
                uid: this.uid,
                isConnected: this.isConnected,
                connectOptions: this.connectOptions,
                publishMessage: this.publishMessage.bind(this),
                populateWindowObject: () => walletClient.populateWindowObject(),
                disconnect: async () => walletClient.disconnect(),
                setConnected: (value: boolean) => {
                  this.isConnected = value;
                },
                processPendingRequests: async () =>
                  walletClient.processPendingRequests(),
              })
            );
          } catch (err) {
            reject(err);
          }
        });

        this.client!.on("error", reject);
      });
    } catch (error) {
      this.requestCoordinator.clearPendingRequests();
      await this.disconnect(walletClient);
      throw error;
    }
  }

  public async disconnect(walletClient: any): Promise<void> {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem("aosync-topic-id")) {
        sessionStorage.removeItem("aosync-topic-id");
        this.sessionActive = false;
        sessionStorage.removeItem("aosync-session-active");

        this.messageHandler.getCache().clear();

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("aosync-session-change", {
              detail: { isActive: false },
            })
          );
        }
      }
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
              this.isConnected = false;
              this.uid = null;

              this.requestCoordinator.resolveAllListeners(
                new Error("Disconnected before response was received")
              );

              this.requestCoordinator.clearAllTimeouts();
              resolve();
            });

            this.client!.on("error", reject);
          }
        );
      }
    });
  }

  public async publishMessage(
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

  public getClient(): MqttClient | null {
    return this.client;
  }

  public getUid(): string | null {
    return this.uid;
  }

  public getConnectOptions(): ConnectionOptions {
    return this.connectOptions;
  }

  public isClientConnected(): boolean {
    return this.isConnected;
  }

  public setConnected(value: boolean): void {
    this.isConnected = value;
  }

  public getSessionActive(): boolean {
    return this.sessionActive;
  }

  public setSessionActive(value: boolean): void {
    this.sessionActive = value;
  }

  public callConnectionListener(response: any): void {
    if (this.connectionListener) {
      this.connectionListener(response);
    }
  }

  public getAccountType(): AccountType {
    return this.connectOptions?.accountType || "arweave";
  }

  public getSupportedChains(): ChainType[] {
    if (this.connectOptions?.accountType === "multichain") {
      return ["ethereum", "base", "solana"];
    }
    return ["arweave", "ao"];
  }

  public getActiveChain(): ChainType {
    const cached = this.messageHandler.getCache().getActiveChain();
    if (cached) return cached;

    return this.connectOptions?.accountType === "multichain" ? "ethereum" : "arweave";
  }
}
