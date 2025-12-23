import type { ConnectionOptions, ChainType, AccountType, MultiChainWallet } from "../types";

const CACHE_KEYS = {
  activeAddress: (chain: ChainType) => `aosync-cached-address-${chain}`,
  allAddresses: (chain: ChainType) => `aosync-cached-all-addresses-${chain}`,
  walletNames: (chain: ChainType) => `aosync-cached-wallet-names-${chain}`,
  permissions: (chain: ChainType) => `aosync-cached-permissions-${chain}`,

  CONNECT_OPTIONS: 'aosync-cached-connect-options',
  ACCOUNT_TYPE: 'aosync-cached-account-type',
  ACTIVE_CHAIN: 'aosync-active-chain',
  MULTICHAIN_ADDRESSES: 'aosync-cached-multichain-addresses',
} as const;

export class SessionStorageCache {
  private isAvailable(): boolean {
    return typeof sessionStorage !== 'undefined';
  }

  public getActiveAddress(chain: ChainType = "arweave"): string | null {
    if (!this.isAvailable()) return null;
    return sessionStorage.getItem(CACHE_KEYS.activeAddress(chain));
  }

  public setActiveAddress(address: string, chain: ChainType = "arweave"): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.activeAddress(chain), address);
  }

  public getAllAddresses(chain: ChainType = "arweave"): string[] | null {
    if (!this.isAvailable()) return null;
    const cached = sessionStorage.getItem(CACHE_KEYS.allAddresses(chain));
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public setAllAddresses(addresses: string[], chain: ChainType = "arweave"): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.allAddresses(chain), JSON.stringify(addresses));
  }

  public getWalletNames(chain: ChainType = "arweave"): { [addr: string]: string } | null {
    if (!this.isAvailable()) return null;
    const cached = sessionStorage.getItem(CACHE_KEYS.walletNames(chain));
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public setWalletNames(names: { [addr: string]: string }, chain: ChainType = "arweave"): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.walletNames(chain), JSON.stringify(names));
  }

  public getPermissions(chain: ChainType = "arweave"): string[] | null {
    if (!this.isAvailable()) return null;
    const cached = sessionStorage.getItem(CACHE_KEYS.permissions(chain));
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public setPermissions(permissions: string[], chain: ChainType = "arweave"): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.permissions(chain), JSON.stringify(permissions));
  }

  public getConnectOptions(): ConnectionOptions | null {
    if (!this.isAvailable()) return null;
    const cached = sessionStorage.getItem(CACHE_KEYS.CONNECT_OPTIONS);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public setConnectOptions(options: ConnectionOptions): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.CONNECT_OPTIONS, JSON.stringify(options));
  }

  public getMultiChainAddresses(): MultiChainWallet | null {
    if (!this.isAvailable()) return null;
    const cached = sessionStorage.getItem(CACHE_KEYS.MULTICHAIN_ADDRESSES);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public setMultiChainAddresses(addresses: MultiChainWallet): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.MULTICHAIN_ADDRESSES, JSON.stringify(addresses));
  }

  public getAccountType(): AccountType | null {
    if (!this.isAvailable()) return null;
    return sessionStorage.getItem(CACHE_KEYS.ACCOUNT_TYPE) as AccountType;
  }

  public setAccountType(type: AccountType): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.ACCOUNT_TYPE, type);
  }

  public getActiveChain(): ChainType | null {
    if (!this.isAvailable()) return null;
    return sessionStorage.getItem(CACHE_KEYS.ACTIVE_CHAIN) as ChainType;
  }

  public setActiveChain(chain: ChainType): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.ACTIVE_CHAIN, chain);
  }

  public clear(): void {
    if (!this.isAvailable()) return;

    const chains: ChainType[] = ["arweave", "ethereum", "base", "solana", "ao"];
    chains.forEach(chain => {
      sessionStorage.removeItem(CACHE_KEYS.activeAddress(chain));
      sessionStorage.removeItem(CACHE_KEYS.allAddresses(chain));
      sessionStorage.removeItem(CACHE_KEYS.walletNames(chain));
      sessionStorage.removeItem(CACHE_KEYS.permissions(chain));
    });

    sessionStorage.removeItem(CACHE_KEYS.CONNECT_OPTIONS);
    sessionStorage.removeItem(CACHE_KEYS.ACCOUNT_TYPE);
    sessionStorage.removeItem(CACHE_KEYS.ACTIVE_CHAIN);
    sessionStorage.removeItem(CACHE_KEYS.MULTICHAIN_ADDRESSES);
  }

  public hasActiveAddress(chain: ChainType = "arweave"): boolean {
    return this.getActiveAddress(chain) !== null;
  }
}
