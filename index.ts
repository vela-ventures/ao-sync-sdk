import mqtt, { IClientOptions, IPublishPacket, MqttClient } from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { Buffer } from 'buffer';
import type Transaction from 'arweave/web/lib/transaction';
import type {
  PermissionType,
  AppInfo,
  GatewayConfig,
  DispatchResult,
  DataItem,
} from 'arconnect';

interface WalletResponse {
  action?: string;
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
  private connectionListener: ((response: any) => void) | null;
  private responseTimeoutMs: number;
  private txTimeoutMs: number;
  private eventListeners: Map<string, Set<(data: any) => void>>;
  private activeTimeouts: Set<NodeJS.Timeout>;

  constructor(responseTimeoutMs = 30000, txTimeoutMs = 300000) {
    this.client = null;
    this.uid = uuidv4();
    this.qrCode = null;
    this.modal = null;
    this.responseListeners = new Map();
    this.connectionListener = null;
    this.responseTimeoutMs = responseTimeoutMs;
    this.txTimeoutMs = txTimeoutMs;
    this.eventListeners = new Map();
    this.activeTimeouts = new Set();
  }

  private createModal(qrCodeData: string, styles?: ModalStyles): void {
    if (this.modal) return;

    // Create modal backdrop
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '999999',
    });

    // Create modal content
    const content = document.createElement('div');
    Object.assign(content.style, {
      background: 'white',
      borderRadius: '16px',
      padding: '28px',
      textAlign: 'center',
      minWidth: '300px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    });

    content.innerHTML = `
      <h3 style="color: #000; font-size: 18px; font-weight: 500; margin-bottom: 5px;">AOSync</h3>
      <div style="font-size: 14px; color: #2B2B2B; margin-bottom: 2px;">Scan with your beacon wallet</div>
      <img src="${qrCodeData}" alt="QR Code" style="width: 200px; height: 200px; margin-bottom: 10px;">
      <div style="font-size: 11px; color: #2B2B2B;">
        Don't have beacon yet?
        <a href="https://beaconwallet.com" 
           target="_blank" 
           style="color: #09084B; text-decoration: none; display: block; margin-top: 8px;">
          beaconwallet.com
        </a>
      </div>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);
    this.modal = modal;
  }

  private createModalContent(
    qrCodeData: string,
    styles?: ModalStyles
  ): HTMLDivElement {
    const content = document.createElement('div');
    Object.assign(content.style, {
      backgroundColor: '#fff',
      padding: styles?.padding || '20px',
      borderRadius: '23px',
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
      textAlign: 'center',
      color: '#000',
      display: 'flex',
      justifyContent: 'center',
      flexDirection: 'column',
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
        maxWidth: '180px',
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

  private async handleMQTTMessage(
    topic: string,
    message: Buffer,
    packet: IPublishPacket
  ): Promise<void> {
    const responseChannel = `${this.uid}/response`;
    if (topic !== responseChannel) return;

    const messageData = JSON.parse(message.toString()) as WalletResponse;

    if (messageData.action === 'connect') {
      this.closeModal();
      await this.handleConnectResponse(packet);
      return;
    }

    if (messageData.action === 'disconnect') {
      await this.handleDisconnectResponse();
      return;
    }

    const correlationId = packet?.properties?.correlationData?.toString();
    if (correlationId && this.responseListeners.has(correlationId)) {
      const resolve = this.responseListeners.get(correlationId)!;
      resolve(messageData.data);
      this.responseListeners.delete(correlationId);
    }
  }

  private async handleConnectResponse(packet: IPublishPacket): Promise<void> {
    if (this.connectionListener) {
      this.connectionListener('connected');
    }
    const topic = this.uid;
    const message = {
      appInfo: {
        name: 'Beacon Wallet',
        url: 'https://beaconwallet.app/',
        logo: 'logo string',
      },
      permissions: ['transactions', 'view address', 'balance'],
    };

    const publishOptions = packet?.properties?.correlationData
      ? { properties: { correlationData: packet.properties.correlationData } }
      : {};

    await this.publishMessage(topic, message, publishOptions);
  }

  private async handleDisconnectResponse(): Promise<void> {
    this.emit('disconnected', { reason: 'Beacon wallet initiated disconnect' });
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

    const isTransaction = ['sign', 'dispatch', 'signDataItem'].includes(action);
    const timeoutDuration = isTransaction
      ? this.txTimeoutMs
      : this.responseTimeoutMs;

    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Not connected to MQTT broker'));
        return;
      }

      this.responseListeners.set(correlationData, resolve);

      this.publishMessage(
        topic,
        { action, correlationData, ...payload },
        {
          properties: {
            correlationData: Buffer.from(correlationData, 'utf-8'),
          },
        }
      ).catch((err) => {
        this.responseListeners.delete(correlationData);
        reject(err);
      });

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

  public async connect(
    brokerUrl = 'wss://broker.beaconwallet.dev:8081',
    options: IClientOptions = { protocolVersion: 5 }
  ): Promise<void> {
    if (this.client) {
      console.warn('Already connected to the broker.');
      return;
    }

    this.client = mqtt.connect(brokerUrl, options);
    const responseChannel = `${this.uid}/response`;

    return new Promise((resolve, reject) => {
      this.connectionListener = resolve;
      this.client!.on('connect', async () => {
        try {
          console.log('connected broker subing to ' + responseChannel);
          await new Promise<void>((res, rej) => {
            this.client!.subscribe(responseChannel, (err) => {
              err ? rej(err) : res();
            });
          });

          this.client!.on('message', this.handleMQTTMessage.bind(this));

          const qrCodeData = await QRCode.toDataURL('aosync=' + this.uid);
          this.createModal(qrCodeData);
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
      this.client!.publish(
        this.uid,
        JSON.stringify({ action: 'disconnect' }),
        {},
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          this.client!.end(false, () => {
            this.client = null;

            this.responseListeners.forEach((resolve) =>
              resolve(new Error('Disconnected before response was received'))
            );
            this.responseListeners.clear();

            this.clearAllTimeouts();

            resolve();
          });

          this.client!.on('error', reject);
        }
      );
    });
  }

  public async getActiveAddress(): Promise<string> {
    return this.createResponsePromise('getActiveAddress');
  }

  public async getAllAddresses(): Promise<string[]> {
    return this.createResponsePromise('getAllAddresses');
  }

  public async getPermissions(): Promise<PermissionType[]> {
    return this.createResponsePromise('getPermissions');
  }

  public async getWalletNames(): Promise<{ [addr: string]: string }> {
    return this.createResponsePromise('getWalletNames');
  }

  public async encrypt(
    data: BufferSource,
    algorithm: RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams
  ): Promise<Uint8Array> {
    return this.createResponsePromise('encrypt', { data, algorithm });
  }

  public async decrypt(
    data: BufferSource,
    algorithm: RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams
  ): Promise<Uint8Array> {
    return this.createResponsePromise('decrypt', { data, algorithm });
  }

  public async getArweaveConfig(): Promise<GatewayConfig> {
    const config: GatewayConfig = {
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
    };

    return Promise.resolve(config);
  }

  public async signature(
    data: Uint8Array,
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams
  ): Promise<Uint8Array> {
    const dataString = data.toString();
    return this.createResponsePromise('signature', { data: dataString });
  }

  public async getActivePublicKey(): Promise<string> {
    return this.createResponsePromise('getActivePublicKey');
  }

  public async addToken(id: string): Promise<void> {
    return this.createResponsePromise('addToken', { data: id });
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

  private emit(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach((listener) => listener(data));
    }
  }
}

export default WalletClient;
