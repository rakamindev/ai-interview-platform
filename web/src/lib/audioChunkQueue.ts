const DB_NAME = "audio_ws_queue";
const DB_VERSION = 1;
const STORE_NAME = "audio_chunks";
const SESSION_INDEX = "sessionId";

export interface QueuedAudioChunk {
  id: number;
  sessionId: number;
  sequence: number;
  timestamp: number;
  data: ArrayBuffer;
}

export type QueuedAudioChunkInput = Omit<QueuedAudioChunk, "id">;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex(SESSION_INDEX, "sessionId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });

  return dbPromise;
}

export async function enqueueAudioChunk(chunk: QueuedAudioChunkInput): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(chunk);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to enqueue audio chunk"));
  });
}

export async function getQueuedAudioChunks(sessionId: number): Promise<QueuedAudioChunk[]> {
  const db = await openDb();
  return new Promise<QueuedAudioChunk[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index(SESSION_INDEX);
    const range = IDBKeyRange.only(sessionId);
    const request = index.getAll(range);
    request.onsuccess = () => {
      const chunks = request.result as QueuedAudioChunk[];
      chunks.sort((a, b) => a.sequence - b.sequence);
      resolve(chunks);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to read queued audio chunks"));
  });
}

export async function deleteAudioChunk(id: number): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to delete audio chunk"));
  });
}

export async function clearAudioChunks(sessionId: number): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const index = tx.objectStore(STORE_NAME).index(SESSION_INDEX);
    const range = IDBKeyRange.only(sessionId);
    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to clear audio chunks"));
  });
}
