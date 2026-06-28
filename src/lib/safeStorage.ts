class SafeStorage {
  private memStorage: Record<string, string> = {};

  getItem(key: string): string | null {
    try {
      // Check if localStorage is defined and accessible
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn("Storage warning: localStorage access is restricted in this environment. Falling back to in-memory storage.", e);
    }
    return this.memStorage[key] || null;
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn("Storage warning: localStorage write is restricted. Using in-memory storage.", e);
    }
    this.memStorage[key] = value;
  }

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn("Storage warning: localStorage deletion is restricted.", e);
    }
    delete this.memStorage[key];
  }

  clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear();
        return;
      }
    } catch (e) {
      console.warn("Storage warning: localStorage clear is restricted.", e);
    }
    this.memStorage = {};
  }
}

export const safeStorage = new SafeStorage();
