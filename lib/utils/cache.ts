const CACHE_KEYS = {
  ACTIVE_ADDRESS: 'aosync-cached-address',
  ALL_ADDRESSES: 'aosync-cached-all-addresses',
  WALLET_NAMES: 'aosync-cached-wallet-names',
  PERMISSIONS: 'aosync-cached-permissions',
} as const;

export class SessionStorageCache {
  private isAvailable(): boolean {
    return typeof sessionStorage !== 'undefined';
  }

  public getActiveAddress(): string | null {
    if (!this.isAvailable()) return null;
    return sessionStorage.getItem(CACHE_KEYS.ACTIVE_ADDRESS);
  }

  public setActiveAddress(address: string): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.ACTIVE_ADDRESS, address);
  }

  public getAllAddresses(): string[] | null {
    if (!this.isAvailable()) return null;
    const cached = sessionStorage.getItem(CACHE_KEYS.ALL_ADDRESSES);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public setAllAddresses(addresses: string[]): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.ALL_ADDRESSES, JSON.stringify(addresses));
  }

  public getWalletNames(): { [addr: string]: string } | null {
    if (!this.isAvailable()) return null;
    const cached = sessionStorage.getItem(CACHE_KEYS.WALLET_NAMES);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public setWalletNames(names: { [addr: string]: string }): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.WALLET_NAMES, JSON.stringify(names));
  }

  public getPermissions(): string[] | null {
    if (!this.isAvailable()) return null;
    const cached = sessionStorage.getItem(CACHE_KEYS.PERMISSIONS);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public setPermissions(permissions: string[]): void {
    if (!this.isAvailable()) return;
    sessionStorage.setItem(CACHE_KEYS.PERMISSIONS, JSON.stringify(permissions));
  }

  public clear(): void {
    if (!this.isAvailable()) return;
    sessionStorage.removeItem(CACHE_KEYS.ACTIVE_ADDRESS);
    sessionStorage.removeItem(CACHE_KEYS.ALL_ADDRESSES);
    sessionStorage.removeItem(CACHE_KEYS.WALLET_NAMES);
    sessionStorage.removeItem(CACHE_KEYS.PERMISSIONS);
  }

  public hasActiveAddress(): boolean {
    return this.getActiveAddress() !== null;
  }
}
