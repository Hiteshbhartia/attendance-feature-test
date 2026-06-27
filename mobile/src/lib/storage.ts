import AsyncStorage from "@react-native-async-storage/async-storage";

export const localStoragePolyfill = {
  _cache: new Map<string, string>(),
  getItem(key: string) {
    return this._cache.get(key) || null;
  },
  setItem(key: string, value: string) {
    this._cache.set(key, value);
    AsyncStorage.setItem(key, value).catch(err => console.warn('AsyncStorage set error:', err));
  },
  removeItem(key: string) {
    this._cache.delete(key);
    AsyncStorage.removeItem(key).catch(err => console.warn('AsyncStorage remove error:', err));
  },
  async hydrate() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const stores = await Promise.all(keys.map(async k => {
        const v = await AsyncStorage.getItem(k);
        return [k, v] as const;
      }));
      stores.forEach(([k, v]) => {
        if (v !== null) this._cache.set(k, v);
      });
      console.log(`[Storage] Hydrated ${stores.length} keys from AsyncStorage`);
    } catch (err) {
      console.error('[Storage] Hydration failed:', err);
    }
  }
};

// Apply polyfill
if (typeof window !== "undefined") {
  (window as any).localStorage = localStoragePolyfill;
} else if (typeof globalThis !== "undefined") {
  (globalThis as any).window = { localStorage: localStoragePolyfill };
  (globalThis as any).localStorage = localStoragePolyfill;
}
