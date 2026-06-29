import api from "~/lib/api";

export type SyncStatus = "synced" | "pending" | "syncing" | "error";

export interface PendingChange {
  changes: Record<number, number>;
  reasons: Record<number, string>;
  timestamp: number;
}

export interface StoredPendingData {
  endpoint: string;
  changes: Record<number, number>;
  reasons: Record<number, string>;
  timestamp: number;
}

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

export function savePendingChanges(
  eventOccurrenceId: number,
  type: "student" | "teacher",
  changes: Record<number, number>,
  reasons: Record<number, string>,
): void {
  const key = getStorageKey(eventOccurrenceId, type);
  if (Object.keys(changes).length === 0 && Object.keys(reasons).length === 0) {
    localStorage.removeItem(key);
    return;
  }
  const data: StoredPendingData = {
    endpoint: getEndpoint(eventOccurrenceId, type),
    changes,
    reasons,
    timestamp: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadPendingChanges(
  eventOccurrenceId: number,
  type: "student" | "teacher"
): { changes: Record<number, number>; reasons: Record<number, string> } {
  const key = getStorageKey(eventOccurrenceId, type);
  const raw = localStorage.getItem(key);
  if (!raw) return { changes: {}, reasons: {} };
  try {
    const data: StoredPendingData = JSON.parse(raw);
    return { changes: data.changes || {}, reasons: data.reasons || {} };
  } catch {
    localStorage.removeItem(key);
    return { changes: {}, reasons: {} };
  }
}

export function clearPendingChanges(
  eventOccurrenceId: number,
  type: "student" | "teacher"
): void {
  const key = getStorageKey(eventOccurrenceId, type);
  localStorage.removeItem(key);
}

export function buildPatchPayload(
  changes: Record<number, number>,
  reasons: Record<number, string>,
): {
  attended: number[];
  absent: number[];
  reasons: Record<number, string>;
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

  return { attended, absent, reasons };
}

export async function flushChanges(
  endpoint: string,
  changes: Record<number, number>,
  reasons: Record<number, string> = {},
): Promise<boolean> {
  if (Object.keys(changes).length === 0 && Object.keys(reasons).length === 0) return true;

  const payload = buildPatchPayload(changes, reasons);

  try {
    await api.patch(endpoint, payload);
    return true;
  } catch {
    return false;
  }
}

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

export async function flushAllPending(): Promise<{
  flushed: number;
  failed: number;
}> {
  const keys = getAllPendingKeys();
  let flushed = 0;
  let failed = 0;

  for (const key of keys) {
    const data = parsePendingFromStorage(key);
    if (!data || (Object.keys(data.changes).length === 0 && Object.keys(data.reasons || {}).length === 0)) {
      localStorage.removeItem(key);
      continue;
    }

    const success = await flushChanges(data.endpoint, data.changes, data.reasons);
    if (success) {
      localStorage.removeItem(key);
      flushed++;
    } else {
      failed++;
    }
  }

  return { flushed, failed };
}
