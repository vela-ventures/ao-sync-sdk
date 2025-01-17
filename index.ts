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
import Lottie from 'lottie-web';
import PaperplaneAnimation from './public/assets/paperplane.json';
import pattern from './pettern';

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

interface ResponseListenerData {
  action: string;
  resolve: (response: any) => void;
}

const preconnectGoogleFonts = document.createElement('link');
preconnectGoogleFonts.rel = 'preconnect';
preconnectGoogleFonts.href = 'https://fonts.googleapis.com';
document.head.appendChild(preconnectGoogleFonts);

// Create <link> for preconnect to fonts.gstatic.com with crossorigin
const preconnectGstatic = document.createElement('link');
preconnectGstatic.rel = 'preconnect';
preconnectGstatic.href = 'https://fonts.gstatic.com';
preconnectGstatic.crossOrigin = 'anonymous'; // Specify crossorigin
document.head.appendChild(preconnectGstatic);

// Create <link> for the actual font stylesheet
const fontStylesheet = document.createElement('link');
fontStylesheet.rel = 'stylesheet';
fontStylesheet.href =
  'https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap';
document.head.appendChild(fontStylesheet);

const incodedPattern = btoa(pattern);

class WalletClient {
  private client: MqttClient | null;
  private uid: string | null;
  private qrCode: Promise<string> | null;
  private modal: HTMLDivElement | null;
  private approvalModal: HTMLDivElement | null;
  private responseListeners: Map<string, ResponseListenerData>;
  private connectionListener: ((response: any) => void) | null;
  private responseTimeoutMs: number;
  private txTimeoutMs: number;
  private eventListeners: Map<string, Set<(data: any) => void>>;
  private activeTimeouts: Set<NodeJS.Timeout>;

  constructor(responseTimeoutMs = 30000, txTimeoutMs = 300000) {
    this.client = null;
    this.uid = null;
    this.qrCode = null;
    this.modal = null;
    this.approvalModal = null;
    this.responseListeners = new Map();
    this.connectionListener = null;
    this.responseTimeoutMs = responseTimeoutMs;
    this.txTimeoutMs = txTimeoutMs;
    this.eventListeners = new Map();
    this.activeTimeouts = new Set();
  }

  private createModal(qrCodeData: string, styles?: ModalStyles): void {
    if (this.modal) return;

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
      paddingTop: '47px',
      textAlign: 'center',
      minWidth: '300px',
      fontFamily: 'Sora',
      display: 'flex',
      justifyContent: 'center',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundRepeat: 'no-repeat',
    });

    content.style.backgroundImage = `url(${
      'data:image/svg+xml;base64,' + incodedPattern
    })`;

    content.innerHTML = `
     <div style="width: 50px; height: 50px; border-radius: 50%; background-color: #F7FAFD; margin-bottom: 12px; display: flex; justify-content: center; align-items: center">
      <svg width="16" height="15" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 0.8H0.8V1V4.40476V4.60476H1H1.66667H1.86667V4.40476V1.81905H4.66667H4.86667V1.61905V1V0.8H4.66667H1ZM11.3333 0.8H11.1333V1V1.61905V1.81905H11.3333H14.1333V4.40476V4.60476H14.3333H15H15.2V4.40476V1V0.8H15H11.3333ZM1 10.3952H0.8V10.5952V14V14.2H1H4.66667H4.86667V14V13.381V13.181H4.66667H1.86667V10.5952V10.3952H1.66667H1ZM14.3333 10.3952H14.1333V10.5952V13.181H11.3333H11.1333V13.381V14V14.2H11.3333H15H15.2V14V10.5952V10.3952H15H14.3333Z" fill="black" stroke="black" stroke-width="0.4"/>
      </svg>
      </div>
      <h3 style="color: #000; font-size: 18px; font-weight: 500; margin-bottom: 5px; margin-top: 0px">AOSync</h3>
      <div style="font-size: 14px; color: #2B2B2B; margin-bottom: 2px;">Scan with your beacon wallet</div>
      <img id="aosync-beacon-connection-qrCode" src="${qrCodeData}" alt="QR Code" style="width: 200px; height: 200px; margin-bottom: 10px;">
      <div style="font-size: 11px; color: #2B2B2B;">
        <span id="aosync-beacon-modal-description">Don't have beacon yet?</span>
        <a href="https://beaconwallet.app" 
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

  private createApprovalModal(): void {
    if (this.approvalModal) return;

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

    const content = document.createElement('div');
    Object.assign(content.style, {
      background: 'white',
      borderRadius: '16px',
      padding: '28px',
      paddingTop: '47px',
      textAlign: 'center',
      minWidth: '300px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      justifyContent: 'center',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundRepeat: 'no-repeat',
    });

    content.style.backgroundImage = `url(${
      'data:image/svg+xml;base64,' + incodedPattern
    })`;

    content.innerHTML = `
     <div style="width: 50px; height: 50px; border-radius: 50%; background-color: #F7FAFD; margin-bottom: 12px; display: flex; justify-content: center; align-items: center">
      <svg width="16" height="15" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 0.8H0.8V1V4.40476V4.60476H1H1.66667H1.86667V4.40476V1.81905H4.66667H4.86667V1.61905V1V0.8H4.66667H1ZM11.3333 0.8H11.1333V1V1.61905V1.81905H11.3333H14.1333V4.40476V4.60476H14.3333H15H15.2V4.40476V1V0.8H15H11.3333ZM1 10.3952H0.8V10.5952V14V14.2H1H4.66667H4.86667V14V13.381V13.181H4.66667H1.86667V10.5952V10.3952H1.66667H1ZM14.3333 10.3952H14.1333V10.5952V13.181H11.3333H11.1333V13.381V14V14.2H11.3333H15H15.2V14V10.5952V10.3952H15H14.3333Z" fill="black" stroke="black" stroke-width="0.4"/>
      </svg>
      </div>
      <h3 style="color: #000; font-size: 18px; font-weight: 500; margin-bottom: 5px; margin-top: 0px">AOSync</h3>
      <div style="font-size: 14px; color: #2B2B2B; margin-bottom: 2px;">Approval pending ...</div>
      <div id="aosync-lottie-animation" style="width: 200px; height: 200px; margin-bottom: 10px;"></div>
      <div style="font-size: 11px; color: #2B2B2B;">
        <a href="https://beaconwallet.app" 
           target="_blank" 
           style="color: #09084B; text-decoration: none; display: block; margin-top: 8px;">
          beaconwallet.com
        </a>
      </div>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);
    this.approvalModal = modal;

    const lottieContainer = document.getElementById('aosync-lottie-animation');
    if (lottieContainer) {
      try {
        Lottie.loadAnimation({
          container: lottieContainer,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: '../paperplane.json',
          animationData: PaperplaneAnimation,
        });
      } catch (error) {
        console.log(error);
      }
    }
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

  private connectionModalSuccessMessage(): void {
    const qrCode = document.getElementById('aosync-beacon-connection-qrCode');

    const modalDescription = document.getElementById(
      'aosync-beacon-modal-description'
    );
    const successMark = document.createElement('div');
    Object.assign(successMark.style, {
      width: '200px',
      height: '200px',
      marginBottom: '10px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: '30px',
      boxSizing: 'border-box',
    });
    if (modalDescription) {
      modalDescription!.style.visibility = 'hidden';
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

    if (messageData.action === 'connect') {
      this.connectionModalSuccessMessage();
      await this.handleConnectResponse(packet);
      return;
    }

    if (messageData.action === 'disconnect') {
      await this.handleDisconnectResponse();
      return;
    }

    const correlationId = packet?.properties?.correlationData?.toString();
    if (correlationId && this.responseListeners.has(correlationId)) {
      const listenerData = this.responseListeners.get(correlationId)!;
      const isTransaction = ['sign', 'dispatch', 'signDataItem'].includes(
        listenerData.action
      );
      if (listenerData.action === 'signDataItem') {
        const decodedData = this.base64UrlDecode(messageData.data);
        listenerData.resolve(decodedData);
      } else {
        listenerData.resolve(messageData.data);
      }

      if (isTransaction) {
        this.closeApprovalModal();
      }
      this.responseListeners.delete(correlationId);
    }
  }

  private base64UrlDecode(base64Url: string) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
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

    if (topic) {
      await this.publishMessage(topic, message, publishOptions);
    }
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
              correlationData: Buffer.from(correlationData, 'utf-8'),
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

  public async connect(
    brokerUrl = 'wss://broker.beaconwallet.dev:8081',
    options: IClientOptions = { protocolVersion: 5 }
  ): Promise<void> {
    if (this.client) {
      console.warn('Already connected to the broker.');
      return;
    }

    this.client = mqtt.connect(brokerUrl, options);
    this.uid = uuidv4();
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
      if (this.uid) {
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

              this.responseListeners.forEach((listener) =>
                listener.resolve(
                  new Error('Disconnected before response was received')
                )
              );
              this.responseListeners.clear();

              this.clearAllTimeouts();

              resolve();
            });

            this.client!.on('error', reject);
          }
        );
      }
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
    return this.createResponsePromise('addToken');
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
