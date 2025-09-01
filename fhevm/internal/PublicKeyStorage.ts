import { GenericStringStorage } from "../GenericStringStorage";

// PublicKey caching system with persistence
export class PublicKeyStorage {
  private static readonly STORAGE_KEY = "fhevm_public_keys";
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  
  private storage: GenericStringStorage;
  private memoryCache: Map<string, { publicKey: string; timestamp: number }> = new Map();

  constructor() {
    this.storage = new GenericStringStorage("PublicKeyStorage");
  }

  // Generate cache key based on network and contract addresses
  private getCacheKey(chainId: number, kmsAddress?: string): string {
    return `${chainId}_${kmsAddress || 'default'}`;
  }

  // Check if cached key is still valid
  private isValidCacheEntry(entry: { publicKey: string; timestamp: number }): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < PublicKeyStorage.CACHE_DURATION;
  }

  // Get cached public key
  async getCachedPublicKey(chainId: number, kmsAddress?: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(chainId, kmsAddress);
    
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && this.isValidCacheEntry(memoryEntry)) {
      console.log(`[PublicKeyStorage] Found valid public key in memory cache for ${cacheKey}`);
      return memoryEntry.publicKey;
    }

    // Check persistent storage
    try {
      const storedData = await this.storage.get(PublicKeyStorage.STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        const entry = parsedData[cacheKey];
        
        if (entry && this.isValidCacheEntry(entry)) {
          console.log(`[PublicKeyStorage] Found valid public key in persistent storage for ${cacheKey}`);
          // Update memory cache
          this.memoryCache.set(cacheKey, entry);
          return entry.publicKey;
        }
      }
    } catch (error) {
      console.warn(`[PublicKeyStorage] Error reading from storage:`, error);
    }

    console.log(`[PublicKeyStorage] No valid cached public key found for ${cacheKey}`);
    return null;
  }

  // Store public key in cache
  async setCachedPublicKey(chainId: number, publicKey: string, kmsAddress?: string): Promise<void> {
    const cacheKey = this.getCacheKey(chainId, kmsAddress);
    const entry = {
      publicKey,
      timestamp: Date.now()
    };

    // Update memory cache
    this.memoryCache.set(cacheKey, entry);

    // Update persistent storage
    try {
      let storedData = {};
      const existingData = await this.storage.get(PublicKeyStorage.STORAGE_KEY);
      if (existingData) {
        storedData = JSON.parse(existingData);
      }

      storedData[cacheKey] = entry;
      await this.storage.set(PublicKeyStorage.STORAGE_KEY, JSON.stringify(storedData));
      
      console.log(`[PublicKeyStorage] Cached public key for ${cacheKey}`);
    } catch (error) {
      console.warn(`[PublicKeyStorage] Error writing to storage:`, error);
    }
  }

  // Clear expired entries
  async cleanupExpiredEntries(): Promise<void> {
    try {
      const storedData = await this.storage.get(PublicKeyStorage.STORAGE_KEY);
      if (!storedData) return;

      const parsedData = JSON.parse(storedData);
      const cleanedData = {};
      let hasChanges = false;

      for (const [key, entry] of Object.entries(parsedData)) {
        if (this.isValidCacheEntry(entry as any)) {
          cleanedData[key] = entry;
        } else {
          hasChanges = true;
          console.log(`[PublicKeyStorage] Removing expired entry: ${key}`);
        }
      }

      // Clean memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (!this.isValidCacheEntry(entry)) {
          this.memoryCache.delete(key);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.storage.set(PublicKeyStorage.STORAGE_KEY, JSON.stringify(cleanedData));
        console.log(`[PublicKeyStorage] Cleanup completed`);
      }
    } catch (error) {
      console.warn(`[PublicKeyStorage] Error during cleanup:`, error);
    }
  }

  // Clear all cached keys
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    await this.storage.delete(PublicKeyStorage.STORAGE_KEY);
    console.log(`[PublicKeyStorage] All cached keys cleared`);
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    memoryEntries: number;
    persistentEntries: number;
    validEntries: number;
    expiredEntries: number;
  }> {
    let persistentEntries = 0;
    let validEntries = 0;
    let expiredEntries = 0;

    try {
      const storedData = await this.storage.get(PublicKeyStorage.STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        persistentEntries = Object.keys(parsedData).length;

        for (const entry of Object.values(parsedData)) {
          if (this.isValidCacheEntry(entry as any)) {
            validEntries++;
          } else {
            expiredEntries++;
          }
        }
      }
    } catch (error) {
      console.warn(`[PublicKeyStorage] Error getting cache stats:`, error);
    }

    return {
      memoryEntries: this.memoryCache.size,
      persistentEntries,
      validEntries,
      expiredEntries
    };
  }
}