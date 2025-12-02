import type { PermissionType, AppInfo, GatewayConfig } from "arconnect";
import { VERSION } from "../constants/version";

export class WindowApiInjector {
  private browserWalletBackup: Window["arweaveWallet"];

  constructor() {
    this.browserWalletBackup = undefined;
  }

  public injectApi(walletClient: any, isConnected: boolean): void {
    if (typeof window === "undefined") return;
    if (window?.arweaveWallet?.walletName === "AOSync") return;

    const createMethodWrapper = (method: Function) => {
      return async (...args: any[]) => {
        if (!isConnected) {
          throw new Error(
            "Wallet is not connected. Please call connect() first."
          );
        }
        return method.apply(walletClient, args);
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
        await walletClient.connect({ permissions, appInfo, gateway });
      },
      disconnect: walletClient.disconnect.bind(walletClient),
      getActiveAddress: createMethodWrapper(walletClient.getActiveAddress),
      getAllAddresses: createMethodWrapper(walletClient.getAllAddresses),
      getPermissions: createMethodWrapper(walletClient.getPermissions),
      getWalletNames: createMethodWrapper(walletClient.getWalletNames),
      encrypt: createMethodWrapper(walletClient.encrypt),
      decrypt: createMethodWrapper(walletClient.decrypt),
      getArweaveConfig: createMethodWrapper(walletClient.getArweaveConfig),
      signature: createMethodWrapper(walletClient.signature),
      getActivePublicKey: createMethodWrapper(walletClient.getActivePublicKey),
      addToken: createMethodWrapper(walletClient.addToken),
      sign: createMethodWrapper(walletClient.sign),
      dispatch: createMethodWrapper(walletClient.dispatch),
      signDataItem: createMethodWrapper(walletClient.signDataItem),
      userTokens: createMethodWrapper(walletClient.userTokens),
    };

    if (window.arweaveWallet) {
      this.browserWalletBackup = window.arweaveWallet;
    }

    window.arweaveWallet = walletApi;
  }

  public restoreBackup(): void {
    if (typeof window === "undefined") return;
    if (this.browserWalletBackup) {
      window.arweaveWallet = this.browserWalletBackup;
    }
  }

  public getBrowserWalletBackup(): Window["arweaveWallet"] {
    return this.browserWalletBackup;
  }
}
