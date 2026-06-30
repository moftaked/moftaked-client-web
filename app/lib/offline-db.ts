/**
 * offline-db.ts
 *
 * A lightweight IndexedDB wrapper for caching API responses offline.
 * Each cached entry is keyed by a resource key (e.g. "classes", "class_1_students")
 * and stores the data alongside a `fetchedAt` ISO timestamp so the sync manager
 * can compare it with the server's `last_updated` value.
 */

const DB_NAME = "moftaked-offline";
const DB_VERSION = 1;
const CACHE_STORE = "cache";
const META_STORE = "meta";

// ---------------------------------------------------------------------------
// Open / upgrade
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

async function getFromStore<T>(
  storeName: string,
  key: string
): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => {
      resolve(req.result as T | undefined);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function putToStore<T>(
  storeName: string,
  value: T
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(value);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function deleteFromStore(
  storeName: string,
  key: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// ---------------------------------------------------------------------------
// Cache entry type
// ---------------------------------------------------------------------------

export interface CacheEntry<T = unknown> {
  /** The resource key, e.g. "classes", "class_1_students" */
  key: string;
  /** The cached payload */
  data: T;
  /** ISO-8601 timestamp of when this data was fetched from the server */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Public API – Cache operations
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached entry by resource key.
 * Returns `undefined` if nothing is cached for that key.
 */
export async function getCached<T = unknown>(
  key: string
): Promise<CacheEntry<T> | undefined> {
  try {
    return await getFromStore<CacheEntry<T>>(CACHE_STORE, key);
  } catch {
    return undefined;
  }
}

/**
 * Store data in the cache for a given resource key.
 * `fetchedAt` defaults to the current time if not provided.
 */
export async function setCached<T = unknown>(
  key: string,
  data: T,
  fetchedAt?: string
): Promise<void> {
  const entry: CacheEntry<T> = {
    key,
    data,
    fetchedAt: fetchedAt ?? new Date().toISOString(),
  };
  try {
    await putToStore(CACHE_STORE, entry);
  } catch {
    // Silently ignore storage errors (e.g. quota exceeded)
  }
}

/**
 * Remove a single cached entry.
 */
export async function removeCached(key: string): Promise<void> {
  try {
    await deleteFromStore(CACHE_STORE, key);
  } catch {
    // ignore
  }
}

/**
 * Get all cached entries.
 */
export async function getAllCached(): Promise<CacheEntry[]> {
  try {
    return await getAllFromStore<CacheEntry>(CACHE_STORE);
  } catch {
    return [];
  }
}

/**
 * Clear the entire cache.
 */
export async function clearCache(): Promise<void> {
  try {
    await clearStore(CACHE_STORE);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Public API – Meta store (for arbitrary key-value pairs)
// ---------------------------------------------------------------------------

export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * Get a metadata value.
 */
export async function getMeta<T = unknown>(
  key: string
): Promise<T | undefined> {
  try {
    const entry = await getFromStore<MetaEntry>(META_STORE, key);
    return entry?.value as T | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Set a metadata value.
 */
export async function setMeta<T = unknown>(
  key: string,
  value: T
): Promise<void> {
  try {
    await putToStore(META_STORE, { key, value });
  } catch {
    // ignore
  }
}

/**
 * Remove a metadata entry.
 */
export async function removeMeta(key: string): Promise<void> {
  try {
    await deleteFromStore(META_STORE, key);
  } catch {
    // ignore
  }
}

/**
 * Clear the entire meta store.
 */
export async function clearMeta(): Promise<void> {
  try {
    await clearStore(META_STORE);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Resource key builders (must match the server's data-versions keys)
// ---------------------------------------------------------------------------

export function classStudentsKey(classId: number | string): string {
  return `class_${classId}_students`;
}

export function classTeachersKey(classId: number | string): string {
  return `class_${classId}_teachers`;
}

export function classEventsKey(classId: number | string): string {
  return `class_${classId}_events_v2`;
}

export function eventOccurrencesKey(eventId: number | string): string {
  return `event_${eventId}_occurrences`;
}

export function occurrenceAttendanceKey(
  occurrenceId: number | string,
  type: "student" | "teacher"
): string {
  return `occurrence_${occurrenceId}_attendance_${type}`;
}

export function personProfileKey(personId: number | string, type: "student" | "teacher"): string {
  return `person_${type}_${personId}`;
}

export const CLASSES_KEY = "classes";
export const DISTRICTS_KEY = "districts";

// ---------------------------------------------------------------------------
// Utility: clear all offline data (e.g. on logout)
// ---------------------------------------------------------------------------

export async function clearAllOfflineData(): Promise<void> {
  await clearCache();
  await clearMeta();
}