/**
 * prefetch-data.ts
 *
 * Eagerly fetches and caches API data for ALL of the user's classes and events
 * in the background so that every page works offline — even pages the user
 * hasn't visited yet.
 *
 * Call `prefetchAllData()` once after the user is authenticated and the app
 * has loaded (e.g. from the main layout). It is safe to call multiple times;
 * concurrent runs are deduped and a minimum interval is enforced.
 *
 * The prefetch walks the user's data graph:
 *   /classes → for each class:
 *     /events/classes/:classId           → classEventsKey
 *     /classes/:classId/students         → classStudentsKey
 *     /classes/:classId/teachers         → classTeachersKey
 *     for each event:
 *       /events/:eventId/occurrences     → eventOccurrencesKey
 *   /districts                           → DISTRICTS_KEY
 */

import api from "~/lib/api";
import { fetchAndCache } from "~/lib/sync-manager";
import {
  CLASSES_KEY,
  DISTRICTS_KEY,
  classEventsKey,
  classStudentsKey,
  classTeachersKey,
  eventOccurrencesKey,
} from "~/lib/offline-db";

// ---------------------------------------------------------------------------
// Types (mirrored from route files — keep lightweight)
// ---------------------------------------------------------------------------

interface ClassInfo {
  class_id: number;
  class_name: string;
}

interface SchoolWithClasses {
  school_id: number;
  school_name: string;
  classes: ClassInfo[];
}

interface EventInfo {
  event_id: number;
  event_name: string;
}

interface EventsData {
  studentEvents: EventInfo[];
  teacherEvents: EventInfo[];
}

interface CachedEventsData {
  studentEvents: EventInfo[];
  teacherEvents: EventInfo[];
  role: string;
}

interface Occurrence {
  event_occurence_id: number;
  occurence_date: string;
}

interface District {
  district_id: number;
  district_name: string;
}

interface Student {
  person_id: number;
  person_name: string;
  district_id: number | null;
}

interface Teacher {
  person_id: number;
  person_name: string;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Minimum time (ms) between full prefetch runs. Default: 5 minutes. */
const MIN_PREFETCH_INTERVAL_MS = 5 * 60 * 1000;

let lastPrefetchAt = 0;
let running: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Kick off a background prefetch of all data the user might need offline.
 *
 * - Deduped: if a prefetch is already in progress, the existing promise is
 *   returned instead of starting a new one.
 * - Throttled: won't run more often than `MIN_PREFETCH_INTERVAL_MS`.
 * - Silent: swallows all errors so it never breaks the UI.
 *
 * @param force  Skip the throttle check and run immediately.
 */
export function prefetchAllData(force = false): Promise<void> {
  if (running) return running;

  const now = Date.now();
  if (!force && lastPrefetchAt > 0 && now - lastPrefetchAt < MIN_PREFETCH_INTERVAL_MS) {
    return Promise.resolve();
  }

  running = _doPrefetch()
    .catch(() => {
      // Silently ignore — prefetch is best-effort
    })
    .finally(() => {
      running = null;
    });

  return running;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function _doPrefetch(): Promise<void> {
  // 1. Fetch the class list (also used by home + attendance pages)
  const schools = await fetchAndCache<SchoolWithClasses[]>(
    CLASSES_KEY,
    async () => {
      const res = await api.get<SchoolWithClasses[]>("/classes");
      return res.data;
    },
  );

  // Flatten all class IDs
  const allClasses: ClassInfo[] = schools.flatMap((s) => s.classes);

  // 2. Fire off per-class prefetches + districts in parallel
  await Promise.allSettled([
    _prefetchDistricts(),
    ...allClasses.map((cls) => _prefetchClassData(cls.class_id)),
  ]);

  lastPrefetchAt = Date.now();
}

/** Prefetch districts list. */
async function _prefetchDistricts(): Promise<void> {
  await fetchAndCache<District[]>(DISTRICTS_KEY, async () => {
    const res = await api.get<{ success: boolean; data: District[] }>("/districts");
    return res.data.data;
  });
}

/** Prefetch all data for a single class: events, students, teachers, occurrences. */
async function _prefetchClassData(classId: number): Promise<void> {
  // Fetch events for this class
  const eventsData = await fetchAndCache<CachedEventsData>(
    classEventsKey(classId),
    async () => {
      const res = await api.get<{
        success: boolean;
        data: EventsData;
        role: string;
      }>(`/events/classes/${classId}`);
      return {
        studentEvents: res.data.data.studentEvents,
        teacherEvents: res.data.data.teacherEvents,
        role: res.data.role,
      };
    },
  );

  // Collect unique event IDs
  const eventMap = new Map<number, EventInfo>();
  for (const e of eventsData.studentEvents) eventMap.set(e.event_id, e);
  for (const e of eventsData.teacherEvents) eventMap.set(e.event_id, e);

  // Prefetch students, teachers, and all event occurrences in parallel
  await Promise.allSettled([
    _prefetchStudents(classId),
    _prefetchTeachers(classId),
    ...Array.from(eventMap.keys()).map((eventId) =>
      _prefetchOccurrences(eventId),
    ),
  ]);
}

async function _prefetchStudents(classId: number): Promise<void> {
  await fetchAndCache<Student[]>(classStudentsKey(classId), async () => {
    const res = await api.get<{ success: boolean; data: Student[] }>(
      `/classes/${classId}/students`,
    );
    return res.data.data;
  });
}

async function _prefetchTeachers(classId: number): Promise<void> {
  await fetchAndCache<Teacher[] | null>(classTeachersKey(classId), async () => {
    try {
      const res = await api.get<{ success: boolean; data: Teacher[] }>(
        `/classes/${classId}/teachers`,
      );
      return res.data.data;
    } catch {
      // User may not have permission to see teachers — that's OK
      return null;
    }
  });
}

async function _prefetchOccurrences(eventId: number): Promise<void> {
  await fetchAndCache<Occurrence[]>(eventOccurrencesKey(eventId), async () => {
    const res = await api.get<{ success: boolean; data: Occurrence[] }>(
      `/events/${eventId}/occurrences`,
    );
    return res.data.data;
  });
}