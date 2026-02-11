import api from "~/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus = "synced" | "pending" | "syncing" | "error";

export interface PendingChange {
  /** person_id → desired attended value (1 or 0) */
  changes: Record<number, number>;
  timestamp: number;
}

export interface StoredPendingData {
  endpoint: string;
  changes: Record<number, number>;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Storage key helpers
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "attendance_pending_";

export function getStorageKey(
  eventOccurrenceId: number,
  type: "student" | "teacher"
): string {
  return `${STORAGE_PREFIX}${eventOccurrenceId}_${type}`;
}

export function getEndpoint(
  eventOccurrenceId: number,
  type: "student" | "teacher"
): string {
  return type === "student"
    ? `/attendance/${eventOccurrenceId}/students`
    : `/attendance/${eventOccurrenceId}/teachers`;
}

// ---------------------------------------------------------------------------
// localStorage operations
// ---------------------------------------------------------------------------

export function savePendingChanges(
  eventOccurrenceId: number,
  type: "student" | "teacher",
  changes: Record<number, number>
): void {
  const key = getStorageKey(eventOccurrenceId, type);
  if (Object.keys(changes).length === 0) {
    localStorage.removeItem(key);
    return;
  }
  const data: StoredPendingData = {
    endpoint: getEndpoint(eventOccurrenceId, type),
    changes,
    timestamp: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadPendingChanges(
  eventOccurrenceId: number,
  type: "student" | "teacher"
): Record<number, number> {
  const key = getStorageKey(eventOccurrenceId, type);
  const raw = localStorage.getItem(key);
  if (!raw) return {};
  try {
    const data: StoredPendingData = JSON.parse(raw);
    return data.changes;
  } catch {
    localStorage.removeItem(key);
    return {};
  }
}

export function clearPendingChanges(
  eventOccurrenceId: number,
  type: "student" | "teacher"
): void {
  const key = getStorageKey(eventOccurrenceId, type);
  localStorage.removeItem(key);
}

// ---------------------------------------------------------------------------
// Build PATCH payload from accumulated changes
// ---------------------------------------------------------------------------

export function buildPatchPayload(changes: Record<number, number>): {
  attended: number[];
  absent: number[];
} {
  const attended: number[] = [];
  const absent: number[] = [];

  for (const [personIdStr, value] of Object.entries(changes)) {
    const personId = Number(personIdStr);
    if (value === 1) {
      attended.push(personId);
    } else {
      absent.push(personId);
    }
  }

  return { attended, absent };
}

// ---------------------------------------------------------------------------
// Flush a specific set of pending changes to the API
// ---------------------------------------------------------------------------

export async function flushChanges(
  endpoint: string,
  changes: Record<number, number>
): Promise<boolean> {
  if (Object.keys(changes).length === 0) return true;

  const payload = buildPatchPayload(changes);

  try {
    await api.patch(endpoint, payload);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scan all localStorage for any pending attendance data (for startup flush)
// ---------------------------------------------------------------------------

export function getAllPendingKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

export function parsePendingFromStorage(key: string): StoredPendingData | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPendingData;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Flush all pending attendance data found in localStorage.
 * Returns the number of successfully flushed entries.
 */
export async function flushAllPending(): Promise<{
  flushed: number;
  failed: number;
}> {
  const keys = getAllPendingKeys();
  let flushed = 0;
  let failed = 0;

  for (const key of keys) {
    const data = parsePendingFromStorage(key);
    if (!data || Object.keys(data.changes).length === 0) {
      localStorage.removeItem(key);
      continue;
    }

    const success = await flushChanges(data.endpoint, data.changes);
    if (success) {
      localStorage.removeItem(key);
      flushed++;
    } else {
      failed++;
    }
  }

  return { flushed, failed };
}