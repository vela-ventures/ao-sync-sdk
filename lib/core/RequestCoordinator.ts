import { v4 as uuidv4 } from "uuid";
import { Buffer } from "buffer";
import mqtt from "mqtt";
import { ResponseListenerData } from "../types";
import { connectionModalMessage } from "../templates";
import { SessionStorageCache } from "../utils/cache";

export class RequestCoordinator {
  private responseListeners: Map<string, ResponseListenerData>;
  private pendingRequests: Array<{
    method: string;
    args: any[];
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>;
  private activeTimeouts: Set<NodeJS.Timeout>;
  private responseTimeoutMs: number;
  private txTimeoutMs: number;

  constructor(responseTimeoutMs = 30000, txTimeoutMs = 300000) {
    this.responseListeners = new Map();
    this.pendingRequests = [];
    this.activeTimeouts = new Set();
    this.responseTimeoutMs = responseTimeoutMs;
    this.txTimeoutMs = txTimeoutMs;
  }

  public createResponsePromise<T>(
    action: string,
    payload: any = {},
    context: {
      uid: string | null;
      client: mqtt.MqttClient | null;
      publishMessage: (
        topic: string,
        message: any,
        options?: mqtt.IClientPublishOptions
      ) => Promise<void>;
      createApprovalModal: () => void;
      autoSign: boolean | null;
      sessionActive: boolean;
      cache: SessionStorageCache;
    }
  ): Promise<T> {
    if (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem("aosync-topic-id") &&
      !context.client
    ) {
      // Check if we have cached data for read-only queries
      if (action === "getActiveAddress") {
        const cachedAddress = context.cache.getActiveAddress();
        if (cachedAddress) {
          return Promise.resolve(cachedAddress as T);
        }
      } else if (action === "getAllAddresses") {
        const cachedAddresses = context.cache.getAllAddresses();
        if (cachedAddresses) {
          return Promise.resolve(cachedAddresses as T);
        }
      } else if (action === "getWalletNames") {
        const cachedNames = context.cache.getWalletNames();
        if (cachedNames) {
          return Promise.resolve(cachedNames as T);
        }
      } else if (action === "getPermissions") {
        const cachedPermissions = context.cache.getPermissions();
        if (cachedPermissions) {
          return Promise.resolve(cachedPermissions as T);
        }
      }

      // No cache available, queue as pending request with timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = this.pendingRequests.findIndex(
            r => r.resolve === resolve
          );
          if (index !== -1) {
            this.pendingRequests.splice(index, 1);
          }
          this.activeTimeouts.delete(timeout);
          reject(new Error(`${action} timeout - no active connection`));
        }, this.responseTimeoutMs);

        this.activeTimeouts.add(timeout);

        this.pendingRequests.push({
          method: action,
          args: [payload],
          resolve: (value: any) => {
            clearTimeout(timeout);
            this.activeTimeouts.delete(timeout);
            resolve(value);
          },
          reject: (error: any) => {
            clearTimeout(timeout);
            this.activeTimeouts.delete(timeout);
            reject(error);
          },
        });
      });
    }

    if (
      typeof sessionStorage !== "undefined" &&
      !sessionStorage.getItem("aosync-topic-id") &&
      !context.client
    ) {
      return;
    }

    const correlationData = uuidv4();
    const topic = context.uid;

    const isTransaction = ["sign", "dispatch", "signDataItem"].includes(action);
    const timeoutDuration = isTransaction
      ? this.txTimeoutMs
      : this.responseTimeoutMs;

    return new Promise((resolve, reject) => {
      if (!context.client) {
        reject(new Error(`Not connected to AOSync`));
        return;
      }

      this.responseListeners.set(correlationData, {
        action,
        resolve,
      });

      if (topic) {
        context
          .publishMessage(
            topic,
            { action, correlationData, ...payload },
            {
              properties: {
                correlationData: Buffer.from(correlationData, "utf-8"),
              },
              ...(isTransaction && { retain: true }),
            }
          )
          .catch((err) => {
            this.responseListeners.delete(correlationData);
            reject(err);
          });
      }

      if (isTransaction) {
        if (context.autoSign) {
          const actionTag = payload.dataItem?.tags.find(
            (tag) => tag.name === "Action"
          );
          if (actionTag?.value === "Transfer") {
            context.createApprovalModal();
          }
        } else {
          context.createApprovalModal();
        }
      }

      const timeout = setTimeout(() => {
        if (this.responseListeners.has(correlationData)) {
          this.responseListeners.delete(correlationData);
          reject(new Error(`${action} timeout`));
        }
        if (isTransaction) {
          if (
            typeof document !== "undefined" &&
            document.getElementById("aosync-modal")
          ) {
            connectionModalMessage("fail");
          }
        }
        this.activeTimeouts.delete(timeout);
      }, timeoutDuration);

      this.activeTimeouts.add(timeout);
    });
  }

  public addPendingRequest(request: {
    method: string;
    args: any[];
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }): void {
    this.pendingRequests.push(request);
  }

  public async processPendingRequests(
    walletClient: any
  ): Promise<void> {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    for (const request of requests) {
      try {
        const result = await walletClient[request.method](...request.args);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
  }

  public clearPendingRequests(): void {
    this.pendingRequests.forEach((request) => {
      request.reject(new Error("Reconnection failed"));
    });
    this.pendingRequests = [];
  }

  public clearAllTimeouts(): void {
    this.activeTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.activeTimeouts.clear();
  }

  public getResponseListeners(): Map<string, ResponseListenerData> {
    return this.responseListeners;
  }

  public resolveAllListeners(error: Error): void {
    this.responseListeners.forEach((listener) => listener.resolve(error));
    this.responseListeners.clear();
  }
}
