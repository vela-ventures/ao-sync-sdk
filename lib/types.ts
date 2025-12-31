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

export interface TypedDataParams {
  domain: Record<string, any>;
  types: Record<string, any>;
  primaryType: string;
  message: Record<string, any>;
}

export type ChainType = "arweave" | "ethereum" | "base" | "solana" | "ao";

export type AccountType = "arweave" | "multichain";

export interface MultiChainWallet {
  arweave?: string;
  ethereum?: string;
  base?: string;
  solana?: string;
  ao?: string;
}

export interface ConnectionOptions {
  permissions?: PermissionType[];
  appInfo?: AppInfo;
  gateway?: GatewayConfig;
  accountType?: AccountType;
}

interface PersonalWallet {
  tokens: string[];
  name: string;
  type: "personal";
  walletAddress: string;
}

interface SharedWallet {
  name: string;
  threshold: number;
  type: "shared";
  tokens: string[];
  walletAddress: string;
  participants: string[];
}

export interface Contact {
  walletAddress: string;
  name: string;
};

export type Wallet = PersonalWallet | SharedWallet;