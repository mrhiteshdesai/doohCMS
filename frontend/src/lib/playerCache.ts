import { openDB, DBSchema } from 'idb';

interface PlayerDB extends DBSchema {
  media: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      mimeType: string;
      timestamp: number;
      filename: string;
    };
  };
  logs: {
    key: string; // uuid
    value: {
      id: string;
      mediaId: string;
      playlistId: string | null;
      startedAt: string; // ISO string
      duration: number;
    };
    indexes: { 'by_date': string };
  };
}

const DB_NAME = 'smartags-player';
const DB_VERSION = 2;
const MAX_LOGS = 10000;

const initDB = async () => {
  return openDB<PlayerDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('media')) {
        db.createObjectStore('media', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', { keyPath: 'id' });
        logStore.createIndex('by_date', 'startedAt');
      } else {
        // Migration for existing store
        const logStore = transaction.objectStore('logs');
        if (!logStore.indexNames.contains('by_date')) {
             logStore.createIndex('by_date', 'startedAt');
        }
      }
    },
  });
};

export const playerCache = {
  async saveFile(url: string, id: string, mimeType: string, filename?: string): Promise<void> {
    const db = await initDB();
    
    // Check if exists
    const existing = await db.get('media', id);
    if (existing) return;

    // Fetch
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    
    const blob = await response.blob();
    
    await db.put('media', {
      id,
      blob,
      mimeType,
      filename: filename || 'unknown',
      timestamp: Date.now(),
    });
  },

  async getFileBlobUrl(id: string): Promise<string | null> {
    const db = await initDB();
    const record = await db.get('media', id);
    if (!record) return null;
    return URL.createObjectURL(record.blob);
  },

  async getFileCount(): Promise<number> {
    const db = await initDB();
    return db.count('media');
  },

  async getAllFiles() {
    const db = await initDB();
    const tx = db.transaction('media', 'readonly');
    let cursor = await tx.store.openCursor();
    
    const files = [];
    while (cursor) {
      const { id, filename, mimeType, blob, timestamp } = cursor.value;
      files.push({
        id,
        filename,
        mimeType,
        size: blob.size,
        timestamp
      });
      cursor = await cursor.continue();
    }
    return files;
  },

  async hasFile(id: string): Promise<boolean> {
    const db = await initDB();
    const key = await db.getKey('media', id);
    return !!key;
  },

  async getMissingFiles(ids: string[]): Promise<string[]> {
    const db = await initDB();
    const tx = db.transaction('media', 'readonly');
    const store = tx.objectStore('media');
    
    const missing: string[] = [];
    await Promise.all(ids.map(async (id) => {
      const key = await store.getKey(id);
      if (!key) missing.push(id);
    }));
    
    return missing;
  },

  async addLog(log: any) {
    const db = await initDB();
    
    // Check limit and rotate if necessary
    const count = await db.count('logs');
    if (count >= MAX_LOGS) {
        // Delete oldest logs (batch of 100 to avoid frequent single deletes)
        const tx = db.transaction('logs', 'readwrite');
        const index = tx.store.index('by_date');
        let cursor = await index.openCursor();
        
        // Delete oldest 100
        let deleted = 0;
        while (cursor && deleted < 100) {
            await cursor.delete();
            cursor = await cursor.continue();
            deleted++;
        }
        await tx.done;
    }

    await db.put('logs', { ...log, id: crypto.randomUUID() });
  },

  async getLogs() {
    const db = await initDB();
    return db.getAll('logs');
  },

  async removeLogs(ids: string[]) {
    const db = await initDB();
    const tx = db.transaction('logs', 'readwrite');
    await Promise.all(ids.map(id => tx.store.delete(id)));
    await tx.done;
  },
  
  async clearUnusedMedia(activeMediaIds: string[]) {
    const db = await initDB();
    const allKeys = await db.getAllKeys('media');
    const toDelete = allKeys.filter(key => !activeMediaIds.includes(key));
    
    if (toDelete.length > 0) {
      const tx = db.transaction('media', 'readwrite');
      await Promise.all(toDelete.map(key => tx.store.delete(key)));
      await tx.done;
    }
  },

  async clearAll() {
    const db = await initDB();
    await db.clear('media');
    await db.clear('logs');
  }
};
