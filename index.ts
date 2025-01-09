import mqtt, { IClientOptions, IPublishPacket, MqttClient } from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { Buffer } from 'buffer';
import type Transaction from "arweave/web/lib/transaction";
import type { PermissionType, AppInfo, GatewayConfig, DispatchResult, DataItem } from "arconnect";

interface WalletResponse {
  action: string;
  data?: any;
  error?: string;
}

interface ModalStyles {
  backgroundColor?: string;
  width?: string;
  padding?: string;
}

class WalletClient {
  private client: MqttClient | null;
  private uid: string;
  private qrCode: Promise<string> | null;
  private modal: HTMLDivElement | null;
  private responseListeners: Map<string, (response: any) => void>;
  private responseTimeoutMs: number;
  private eventListeners: Map<string, Set<(data: any) => void>>;

  constructor(responseTimeoutMs = 100000) {
    this.client = null;
    this.uid = uuidv4();
    this.qrCode = null;
    this.modal = null;
    this.responseListeners = new Map();
    this.responseTimeoutMs = responseTimeoutMs;
    this.eventListeners = new Map();
  }

  private createModal(qrCodeData: string, styles?: ModalStyles): void {
    if (this.modal) return;

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: styles?.backgroundColor || 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
    });

    const content = this.createModalContent(qrCodeData, styles);
    modal.appendChild(content);
    document.body.appendChild(modal);
    this.modal = modal;
  }

  private createModalContent(qrCodeData: string, styles?: ModalStyles): HTMLDivElement {
    const content = document.createElement('div');
    Object.assign(content.style, {
      backgroundColor: '#fff',
      padding: styles?.padding || '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
      textAlign: 'center',
      color: '#000',
    });

    const text = document.createElement('p');
    text.textContent = 'Scan the QR Code to connect:';
    text.style.marginBottom = '20px';

    const qrImg = document.createElement('img');
    Object.assign(qrImg, {
      id: 'qr-code',
      alt: 'QR Code',
      src: qrCodeData,
      style: {
        maxWidth: '200px',
        height: 'auto',
      },
    });

    const closeButton = this.createCloseButton();
    
    content.append(text, qrImg, closeButton);
    return content;
  }

  private createCloseButton(): HTMLButtonElement {
    const button = document.createElement('button');
    Object.assign(button, {
      textContent: 'Close',
      onclick: () => this.closeModal(),
      style: {
        marginTop: '20px',
        padding: '10px 20px',
        border: 'none',
        backgroundColor: '#007BFF',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
      },
    });
    return button;
  }

  private closeModal(): void {
    if (this.modal) {
      document.body.removeChild(this.modal);
      this.modal = null;
    }
  }

  private async handleMQTTMessage(topic: string, message: Buffer, packet: IPublishPacket): Promise<void> {
    const responseChannel = `${this.uid}/response`;
    if (topic !== responseChannel) return;

    const messageData = JSON.parse(message.toString()) as WalletResponse;
    
    if (messageData.action === 'connect') {
      await this.handleConnectResponse(packet);
    }

    const correlationId = packet?.properties?.correlationData?.toString();
    if (correlationId && this.responseListeners.has(correlationId)) {
      const resolve = this.responseListeners.get(correlationId)!;
      resolve(message.toString());
      this.responseListeners.delete(correlationId);
    }
  }

  private async handleConnectResponse(packet: IPublishPacket): Promise<void> {
    const topic = this.uid;
    const message = {
      appInfo: {
        name: 'some name',
        url: 'test url',
        logo: 'logo string',
      },
      permissions: ['transactions', 'view address', 'balance'],
    };

    const publishOptions = packet?.properties?.correlationData
      ? { properties: { correlationData: packet.properties.correlationData } }
      : {};

    await this.publishMessage(topic, message, publishOptions);
  }

  private async publishMessage(topic: string, message: any, options: mqtt.IClientPublishOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client?.publish(
        topic,
        JSON.stringify(message),
        options,
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  private createResponsePromise<T>(action: string, payload: any = {}): Promise<T> {
    const correlationData = uuidv4();
    const topic = this.uid;

    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Not connected to MQTT broker'));
        return;
      }

      this.responseListeners.set(correlationData, resolve);

      this.publishMessage(
        topic,
        { action, ...payload },
        {
          properties: {
            correlationData: Buffer.from(correlationData, 'utf-8'),
          },
        }
      ).catch((err) => {
        this.responseListeners.delete(correlationData);
        reject(err);
      });

      setTimeout(() => {
        if (this.responseListeners.has(correlationData)) {
          this.responseListeners.delete(correlationData);
          reject(new Error(`${action} timeout`));
        }
      }, this.responseTimeoutMs);
    });
  }

  public async connect(
    brokerUrl = 'ws://coolify.kento.sh:9001',
    options: IClientOptions = { protocolVersion: 5 }
  ): Promise<void> {
    if (this.client) {
      console.warn('Already connected to the broker.');
      return;
    }

    this.client = mqtt.connect(brokerUrl, options);
    const responseChannel = `${this.uid}/response`;

    return new Promise((resolve, reject) => {
      this.client!.on('connect', async () => {
        try {
          console.log('connected broker subing to ' + responseChannel)
          await new Promise<void>((res, rej) => {
            this.client!.subscribe(responseChannel, (err) => {
              err ? rej(err) : res();
            });
          });

          this.client!.on('message', this.handleMQTTMessage.bind(this));
          
          const qrCodeData = await QRCode.toDataURL('aosync=' + this.uid);
          this.createModal(qrCodeData);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.client!.on('error', reject);
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      console.warn('No active MQTT connection to disconnect.');
      return;
    }

    return new Promise((resolve, reject) => {
      this.client!.end(false, () => {
        this.client = null;
        resolve();
      });

      this.client!.on('error', reject);
    });
  }

  public async getActiveAddress(): Promise<string> {
    return this.createResponsePromise('getActiveAddress');
  }

  public async getPermissions(): Promise<PermissionType[]> {
    return this.createResponsePromise('getPermissions');
  }

  public async sign(transaction: Transaction): Promise<Transaction> {
    return this.createResponsePromise('sign', { transaction });
  }

  public async dispatch(transaction: Transaction): Promise<DispatchResult> {
    return this.createResponsePromise('dispatch', { transaction });
  }

  public async signDataItem(dataItem: DataItem): Promise<ArrayBuffer> {
    return this.createResponsePromise('signDataItem', { dataItem });
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
}

export default WalletClient;