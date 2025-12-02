export class EventEmitter {
  private eventListeners: Map<string, Set<(data: any) => void>>;

  constructor() {
    this.eventListeners = new Map();
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

  public emit(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach((listener) => listener(data));
    }
  }
}
