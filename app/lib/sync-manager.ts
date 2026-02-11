/**
 * sync-manager.ts
 *
 * Responsible for checking the server's data-version timestamps against the
 * locally cached `fetchedAt` values in IndexedDB and determining which
 * resources need to be re-fetched.
 *
 * Usage:
 *   import { checkForUpdates, isCacheStale, fetchAndCache } from "~/lib/sync-manager";
 *
 *   // On app load or route change, check which data is stale:
 *   const staleKeys = await checkForUpdates();
 *
 *   // Or check a single key:
 *   const stale = await isCacheStale("class_1_students");
 *
 *   // Generic helper: fetch from API, cache the result, return data
 *   const data = await fetchAndCache("class_1_students", () => api.get(...));
 */

import api from "~/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether a caught value is a React Router redirect Response.
 * The axios interceptor rejects with `redirect('/login')` on 401, which is a
 * Response object. We must never swallow these — they need to propagate so
 * React Router can perform the navigation.
 */
function isRedirect(error: unknown): boolean {
  return error instanceof Response && error.status >= 300 && error.status < 400;
}
import {
  getCached,
  setCached,
  getMeta,
  setMeta,
  type CacheEntry,
} from "~/lib/offline-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The shape returned by GET /sync/timestamps */
interface SyncTimestampsResponse {
  success: boolean;
  data: Record<string, string>; // resource_key → ISO timestamp
}

/** Stored in IndexedDB meta store so we know the last full sync check time */
const LAST_SYNC_CHECK_KEY = "lastSyncCheck";

/**
 * Minimum interval (ms) between full sync checks to avoid hammering the
 * server on every navigation. Default: 30 seconds.
 */
const MIN_SYNC_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// In-memory timestamp cache (avoids hitting IndexedDB on every call)
// ---------------------------------------------------------------------------

let serverTimestamps: Record<string, string> = {};
let serverTimestampsFetchedAt = 0;

// ---------------------------------------------------------------------------
// Core: Fetch server timestamps
// ---------------------------------------------------------------------------

/**
 * Fetch the latest data-version timestamps from the server.
 * Results are cached in-memory for `MIN_SYNC_INTERVAL_MS`.
 *
 * Returns an empty object if the request fails (e.g. offline).
 */
export async function fetchServerTimestamps(
  force = false
): Promise<Record<string, string>> {
  const now = Date.now();

  // Return in-memory cache if fresh enough
  if (
    !force &&
    serverTimestampsFetchedAt > 0 &&
    now - serverTimestampsFetchedAt < MIN_SYNC_INTERVAL_MS
  ) {
    return serverTimestamps;
  }

  try {
    const res = await api.get<SyncTimestampsResponse>("/sync/timestamps");
    serverTimestamps = res.data.data ?? {};
    serverTimestampsFetchedAt = now;

    // Persist the last check time
    await setMeta(LAST_SYNC_CHECK_KEY, new Date().toISOString());

    return serverTimestamps;
  } catch (error) {
    // Let redirect responses (e.g. 401 → /login) propagate
    if (isRedirect(error)) throw error;
    // Offline or server error — return whatever we had
    return serverTimestamps;
  }
}

/**
 * Reset the in-memory timestamp cache (e.g. after logout).
 */
export function resetTimestampCache(): void {
  serverTimestamps = {};
  serverTimestampsFetchedAt = 0;
}

// ---------------------------------------------------------------------------
// Staleness checks
// ---------------------------------------------------------------------------

/**
 * Check whether a single cached resource is stale compared to the server.
 *
 * A resource is considered stale if:
 *  - It has never been cached locally, OR
 *  - The server's `last_updated` timestamp is newer than the local `fetchedAt`.
 *
 * If we can't reach the server (timestamps are empty), we assume fresh (use cache).
 */
export async function isCacheStale(resourceKey: string): Promise<boolean> {
  const timestamps = await fetchServerTimestamps();

  // If the server has no record of this key, it's never been touched.
  // The data may still exist on the server — treat as stale if we have no cache.
  const serverTs = timestamps[resourceKey];

  const cached = await getCached(resourceKey);

  // No local cache → stale
  if (!cached) return true;

  // Server didn't return a timestamp for this key (maybe the server is
  // unreachable or the resource was never touched). Keep local cache.
  if (!serverTs) return false;

  // Compare timestamps
  const serverDate = new Date(serverTs).getTime();
  const localDate = new Date(cached.fetchedAt).getTime();

  return serverDate > localDate;
}

/**
 * Given a list of resource keys, return the subset that is stale.
 */
export async function getStaleKeys(
  resourceKeys: string[]
): Promise<string[]> {
  const timestamps = await fetchServerTimestamps();
  const stale: string[] = [];

  for (const key of resourceKeys) {
    const serverTs = timestamps[key];
    const cached = await getCached(key);

    if (!cached) {
      stale.push(key);
      continue;
    }

    if (!serverTs) continue;

    const serverDate = new Date(serverTs).getTime();
    const localDate = new Date(cached.fetchedAt).getTime();
    if (serverDate > localDate) {
      stale.push(key);
    }
  }

  return stale;
}

/**
 * Perform a full sync check: fetch server timestamps and return all stale
 * resource keys that we have (or should have) cached.
 *
 * This is a lightweight operation — it only compares timestamps, it does NOT
 * re-fetch the actual data. Callers should use the returned keys to decide
 * what to refetch.
 */
export async function checkForUpdates(
  force = false
): Promise<string[]> {
  const timestamps = await fetchServerTimestamps(force);
  const allServerKeys = Object.keys(timestamps);
  return getStaleKeys(allServerKeys);
}

// ---------------------------------------------------------------------------
// Fetch-and-cache helper
// ---------------------------------------------------------------------------

/**
 * Generic helper that:
 *  1. Checks if the cached data for `resourceKey` is still fresh.
 *  2. If fresh, returns the cached data immediately.
 *  3. If stale (or no cache), calls `fetcher()` to get fresh data, caches it,
 *     and returns it.
 *  4. If the fetcher fails (offline), falls back to any existing cache.
 *
 * @param resourceKey  The cache / data-version key (e.g. "class_1_students").
 * @param fetcher      An async function that fetches the data from the API.
 * @returns            The data (either from cache or freshly fetched).
 * @throws             Re-throws the fetcher error if there is no cache fallback.
 */
export async function fetchAndCache<T>(
  resourceKey: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const stale = await isCacheStale(resourceKey);
  const cached = await getCached<T>(resourceKey);

  // Cache is fresh — return immediately
  if (!stale && cached) {
    return cached.data;
  }

  // Need to fetch fresh data
  try {
    const data = await fetcher();
    await setCached(resourceKey, data);
    return data;
  } catch (error) {
    // Let redirect responses (e.g. 401 → /login) propagate
    if (isRedirect(error)) throw error;
    // Offline / error — fall back to cache if available
    if (cached) {
      return cached.data;
    }
    // No cache at all — propagate the error
    throw error;
  }
}

/**
 * Force-fetch from API, update cache, and return data.
 * Does NOT check staleness — always fetches.
 * Falls back to cache on error.
 */
export async function forceFetchAndCache<T>(
  resourceKey: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await getCached<T>(resourceKey);
  try {
    const data = await fetcher();
    await setCached(resourceKey, data);
    return data;
  } catch (error) {
    // Let redirect responses (e.g. 401 → /login) propagate
    if (isRedirect(error)) throw error;
    if (cached) {
      return cached.data;
    }
    throw error;
  }
}

/**
 * Get data from cache only — never hits the network.
 * Returns `undefined` if nothing is cached.
 */
export async function getFromCacheOnly<T>(
  resourceKey: string
): Promise<T | undefined> {
  const entry = await getCached<T>(resourceKey);
  return entry?.data;
}

/**
 * Returns the fetchedAt timestamp for a cached resource, or undefined.
 */
export async function getCacheFetchedAt(
  resourceKey: string
): Promise<string | undefined> {
  const entry = await getCached(resourceKey);
  return entry?.fetchedAt;
}

// ---------------------------------------------------------------------------
// Background sync: refetch all stale data
// ---------------------------------------------------------------------------

/**
 * A registry of fetcher functions that the app registers so the background
 * sync can automatically re-fetch stale data.
 *
 * Key: resource key pattern or exact key
 * Value: fetcher function
 */
const fetcherRegistry = new Map<string, () => Promise<unknown>>();

/**
 * Register a fetcher so background sync can auto-refresh this key.
 */
export function registerFetcher(
  resourceKey: string,
  fetcher: () => Promise<unknown>
): void {
  fetcherRegistry.set(resourceKey, fetcher);
}

/**
 * Unregister a fetcher (e.g. on component unmount).
 */
export function unregisterFetcher(resourceKey: string): void {
  fetcherRegistry.delete(resourceKey);
}

/**
 * Run a background sync: check for stale keys and re-fetch any that have
 * registered fetchers.
 *
 * Returns the number of resources that were successfully refreshed.
 */
export async function backgroundSync(): Promise<number> {
  const staleKeys = await checkForUpdates(true);
  let refreshed = 0;

  for (const key of staleKeys) {
    const fetcher = fetcherRegistry.get(key);
    if (fetcher) {
      try {
        const data = await fetcher();
        await setCached(key, data);
        refreshed++;
      } catch {
        // Skip — will retry on next sync
      }
    }
  }

  return refreshed;
}