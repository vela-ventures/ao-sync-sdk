import { AppInfo, GatewayConfig, PermissionType } from "arconnect";

export interface WalletResponse {
  action?: string;
  data?: any;
  error?: string;
}

export interface ModalStyles {
  backgroundColor?: string;
  width?: string;
  padding?: string;
}

export interface ResponseListenerData {
  action: string;
  resolve: (response: any) => void;
}

export interface ReconnectListenerData {
  corellationId: string;
  resolve: (response: any) => void;
}
export interface ConnectionOptions {
  permissions?: PermissionType[];
  appInfo?: AppInfo;
  gateway?: GatewayConfig;
}
