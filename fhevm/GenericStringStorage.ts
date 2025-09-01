import { openDB, type IDBPDatabase } from 'idb';

// Generic string storage using IndexedDB for persistence
export class GenericStringStorage {
  private dbName: string;
  private storeName: string = 'keyValueStore';
  private dbVersion: number = 1;
  private dbPromise: Promise<IDBPDatabase> | null = null;

  constructor(namespace: string = 'FhevmStorage') {
    this.dbName = `${namespace}_DB`;
  }

  private getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(this.dbName, this.dbVersion, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('keyValueStore')) {
            db.createObjectStore('keyValueStore');
          }
        },
      });
    }
    return this.dbPromise;
  }

  async get(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      const value = await db.get(this.storeName, key);
      return value || null;
    } catch (error) {
      console.warn(`[GenericStringStorage] Error getting key "${key}":`, error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put(this.storeName, value, key);
    } catch (error) {
      console.error(`[GenericStringStorage] Error setting key "${key}":`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete(this.storeName, key);
    } catch (error) {
      console.error(`[GenericStringStorage] Error deleting key "${key}":`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear(this.storeName);
    } catch (error) {
      console.error(`[GenericStringStorage] Error clearing storage:`, error);
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const db = await this.getDB();
      return await db.getAllKeys(this.storeName) as string[];
    } catch (error) {
      console.error(`[GenericStringStorage] Error getting all keys:`, error);
      return [];
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const value = await db.get(this.storeName, key);
      return value !== undefined;
    } catch (error) {
      console.warn(`[GenericStringStorage] Error checking if key "${key}" exists:`, error);
      return false;
    }
  }

  // Backup and restore functionality
  async exportData(): Promise<Record<string, string>> {
    try {
      const db = await this.getDB();
      const keys = await db.getAllKeys(this.storeName);
      const data: Record<string, string> = {};
      
      for (const key of keys) {
        const value = await db.get(this.storeName, key);
        if (value !== undefined) {
          data[key as string] = value;
        }
      }
      
      return data;
    } catch (error) {
      console.error(`[GenericStringStorage] Error exporting data:`, error);
      return {};
    }
  }

  async importData(data: Record<string, string>): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      
      for (const [key, value] of Object.entries(data)) {
        await tx.store.put(value, key);
      }
      
      await tx.done;
    } catch (error) {
      console.error(`[GenericStringStorage] Error importing data:`, error);
      throw error;
    }
  }
}