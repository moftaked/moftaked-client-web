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
 *       attendance for latest occurrence → occurrenceAttendanceKey
 *       person profiles                 → personProfileKey
 *       person photos                   → cache-warmed via fetch
 *   /districts                           → DISTRICTS_KEY
 */

import api from "~/lib/api";
import { fetchAndCache as uncachedFetchAndCache } from "~/lib/sync-manager";

// Suppress the global error dialog for prefetch requests — 5xx errors from
// background prefetches are expected and already handled silently by the
// prefetch code (try/catch + Promise.allSettled).
const prefetchApi = new Proxy(api, {
  get(target, prop: string | symbol) {
    const orig = (target as any)[prop];
    if (typeof orig === "function") {
      return (...args: any[]) => {
        if (args.length > 0 && typeof args[args.length - 1] === "object") {
          args[args.length - 1] = {
            ...args[args.length - 1],
            __suppressGlobalError: true,
          };
        } else if (args.length > 0) {
          args.push({ __suppressGlobalError: true } as any);
        }
        return orig.apply(target, args);
      };
    }
    return orig;
  },
}) as typeof api;
import {
  CLASSES_KEY,
  DISTRICTS_KEY,
  classEventsKey,
  classStudentsKey,
  classTeachersKey,
  eventOccurrencesKey,
  occurrenceAttendanceKey,
  personProfileKey,
  getCached,
} from "~/lib/offline-db";
import { getPhotoUrl } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Progress reporting (public)
// ---------------------------------------------------------------------------

export interface PrefetchProgress {
  loaded: number;
  total: number;
  phase: string;
}

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------

/**
 * Simple async semaphore that limits how many concurrent operations run.
 * Call `acquire()` before starting an op and `release()` when done.
 */
function createSemaphore(maxConcurrent: number) {
  let running = 0;
  const queue: (() => void)[] = [];

  return {
    acquire(): Promise<void> {
      if (running < maxConcurrent) {
        running++;
        return Promise.resolve();
      }
      return new Promise((resolve) => queue.push(resolve));
    },
    release(): void {
      const next = queue.shift();
      if (next) {
        next();
      } else {
        running--;
      }
    },
  };
}

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
  className: string;
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
  student_id: number;
  student_name: string;
}

interface Teacher {
  teacher_id: number;
  teacher_name: string;
}

interface AttendancePerson {
  person_id: number;
  person_name: string;
  attended: number;
  absence_reason?: string | null;
}

interface PersonProfile {
  person_id: number;
  person_name: string;
  photo_link: string | null;
}

interface ClassScope {
  classId: number;
  eventMap: Map<number, EventInfo>;
  hasStudentEvents: Set<number>;
  hasTeacherEvents: Set<number>;
  studentCount: number;
  teacherCount: number;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Minimum time (ms) between full prefetch runs. Default: 5 minutes. */
const MIN_PREFETCH_INTERVAL_MS = 5 * 60 * 1000;

let lastPrefetchAt = 0;
let running: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** Limit photo fetches to 4 concurrent to avoid ERR_INSUFFICIENT_RESOURCES. */
const photoSem = createSemaphore(4);

// ---------------------------------------------------------------------------
// Module-level progress state
// ---------------------------------------------------------------------------

let progressLoaded = 0;
let progressTotal = 0;
let progressPhase = "";
let progressCb: ((p: PrefetchProgress) => void) | null = null;

/**
 * Tracked version of fetchAndCache that advances the progress counter
 * when the extended phase is active (progressTotal > 0).
 */
async function fetchAndCache<T>(
  resourceKey: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const result = await uncachedFetchAndCache(resourceKey, fetcher);
  if (progressTotal > 0) {
    progressLoaded++;
    progressCb?.({ loaded: progressLoaded, total: progressTotal, phase: progressPhase });
  }
  return result;
}

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
 * @param onProgress  Optional callback for progress updates.
 */
export function prefetchAllData(
  force = false,
  onProgress?: (progress: PrefetchProgress) => void,
): Promise<void> {
  if (running) return running;

  const now = Date.now();
  if (!force && lastPrefetchAt > 0 && now - lastPrefetchAt < MIN_PREFETCH_INTERVAL_MS) {
    return Promise.resolve();
  }

  progressCb = onProgress ?? null;
  progressLoaded = 0;
  progressTotal = 0;
  progressPhase = "";

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
  // =====================================================================
  // DISCOVERY PHASE — fetch data we need to know the full scope
  // =====================================================================

  // 1. Fetch the class list
  const schools = await uncachedFetchAndCache<SchoolWithClasses[]>(
    CLASSES_KEY,
    async () => {
      const res = await prefetchApi.get<SchoolWithClasses[]>("/classes");
      return res.data;
    },
  );

  const allClasses: ClassInfo[] = schools.flatMap((s) => s.classes);

  // Districts (fast, runs in parallel with base data below)
  const districtsPromise = uncachedFetchAndCache<District[]>(DISTRICTS_KEY, async () => {
    const res = await prefetchApi.get<{ success: boolean; data: District[] }>("/districts");
    return res.data.data;
  });

  // Collect base data (events, students, teachers) for all classes
  const classScopeResults = await Promise.allSettled(
    allClasses.map((cls) => _prefetchClassBaseData(cls.class_id)),
  );

  // Wait for districts too
  await districtsPromise;

  // Calculate extended-work totals from discovered scopes
  let attendanceCount = 0;
  let profileCount = 0;

  for (const r of classScopeResults) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const scope = r.value;

    for (const eventId of scope.eventMap.keys()) {
      if (scope.hasStudentEvents.has(eventId)) attendanceCount++;
      if (scope.hasTeacherEvents.has(eventId)) attendanceCount++;
    }

    profileCount += scope.studentCount + scope.teacherCount;
  }

  const extendedTotal = attendanceCount + profileCount;

  if (extendedTotal === 0) {
    // Nothing new to prefetch — data is already fresh
    lastPrefetchAt = Date.now();
    progressCb?.({ loaded: 1, total: 1, phase: "البيانات حديثة بالفعل" });
    return;
  }

  // =====================================================================
  // EXTENDED PHASE — tracked by the progress bar
  // =====================================================================

  progressTotal = extendedTotal;
  progressLoaded = 0;

  // Attendance
  progressPhase = "جاري تحميل الحضور...";
  progressCb?.({ loaded: 0, total: extendedTotal, phase: progressPhase });

  await Promise.allSettled(
    classScopeResults.map(async (r) => {
      if (r.status !== "fulfilled" || !r.value) return;
      const scope = r.value;
      await _prefetchLatestAttendance(
        scope.eventMap,
        scope.hasStudentEvents,
        scope.hasTeacherEvents,
      );
    }),
  );

  // Person profiles
  progressPhase = "جاري تحميل البيانات الشخصية...";
  progressCb?.({ loaded: progressLoaded, total: extendedTotal, phase: progressPhase });

  await Promise.allSettled(
    classScopeResults.map(async (r) => {
      if (r.status !== "fulfilled" || !r.value) return;
      await _prefetchPersonDetails(r.value.classId);
    }),
  );

  // Done
  progressPhase = "جميع البيانات جاهزة للاستخدام دون اتصال";
  progressCb?.({ loaded: progressTotal, total: progressTotal, phase: progressPhase });
  lastPrefetchAt = Date.now();
}

/**
 * Fetch base discovery data for a single class.
 * Returns scope info used to calculate exact extended-work totals.
 */
async function _prefetchClassBaseData(classId: number): Promise<ClassScope | null> {
  try {
    const eventsData = await uncachedFetchAndCache<CachedEventsData>(
      classEventsKey(classId),
      async () => {
        const res = await prefetchApi.get<{
          success: boolean;
          data: EventsData;
          role: string;
          className: string;
        }>(`/events/classes/${classId}`);
        return {
          studentEvents: res.data.data.studentEvents,
          teacherEvents: res.data.data.teacherEvents,
          role: res.data.role,
          className: res.data.className,
        };
      },
    );

    const eventMap = new Map<number, EventInfo>();
    for (const e of eventsData.studentEvents) eventMap.set(e.event_id, e);
    for (const e of eventsData.teacherEvents) eventMap.set(e.event_id, e);

    const hasStudentEvents = new Set(eventsData.studentEvents.map((e) => e.event_id));
    const hasTeacherEvents = new Set(eventsData.teacherEvents.map((e) => e.event_id));

    // Fetch students, teachers, occurrences in parallel
    await Promise.allSettled([
      _prefetchStudents(classId),
      _prefetchTeachers(classId),
      ...Array.from(eventMap.keys()).map((eventId) =>
        uncachedFetchAndCache<Occurrence[]>(eventOccurrencesKey(eventId), async () => {
          const res = await prefetchApi.get<{ success: boolean; data: Occurrence[] }>(
            `/events/${eventId}/occurrences`,
          );
          return res.data.data;
        }),
      ),
    ]);

    // Read from cache to get person counts
    const [studentsCached, teachersCached] = await Promise.all([
      getCached<Student[]>(classStudentsKey(classId)),
      getCached<Teacher[] | null>(classTeachersKey(classId)),
    ]);

    return {
      classId,
      eventMap,
      hasStudentEvents,
      hasTeacherEvents,
      studentCount: studentsCached?.data?.length ?? 0,
      teacherCount: teachersCached?.data?.length ?? 0,
    };
  } catch {
    return null;
  }
}

async function _prefetchStudents(classId: number): Promise<void> {
  await uncachedFetchAndCache<Student[]>(classStudentsKey(classId), async () => {
    const res = await prefetchApi.get<{ success: boolean; data: Student[] }>(
      `/classes/${classId}/students`,
    );
    return res.data.data;
  });
}

async function _prefetchTeachers(classId: number): Promise<void> {
  await uncachedFetchAndCache<Teacher[] | null>(classTeachersKey(classId), async () => {
    try {
      const res = await prefetchApi.get<{ success: boolean; data: Teacher[] }>(
        `/classes/${classId}/teachers`,
      );
      return res.data.data;
    } catch {
      return null;
    }
  });
}

/**
 * Prefetch attendance data for the latest occurrence of each event.
 * The occurrences array is sorted by date descending (latest first).
 */
async function _prefetchLatestAttendance(
  eventMap: Map<number, EventInfo>,
  hasStudents: Set<number>,
  hasTeachers: Set<number>,
): Promise<void> {
  await Promise.allSettled(
    Array.from(eventMap.keys()).map(async (eventId) => {
      const cached = await getCached<Occurrence[]>(eventOccurrencesKey(eventId));
      if (!cached?.data?.length) return;
      const latest = cached.data[0];
      const tasks: Promise<void>[] = [];
      if (hasStudents.has(eventId)) {
        tasks.push(_prefetchAttendanceForOccurrence(latest.event_occurence_id, "student"));
      }
      if (hasTeachers.has(eventId)) {
        tasks.push(_prefetchAttendanceForOccurrence(latest.event_occurence_id, "teacher"));
      }
      await Promise.allSettled(tasks);
    }),
  );
}

async function _prefetchAttendanceForOccurrence(
  occurrenceId: number,
  type: "student" | "teacher",
): Promise<void> {
  await fetchAndCache<AttendancePerson[]>(
    occurrenceAttendanceKey(occurrenceId, type),
    async () => {
      const res = await prefetchApi.get<{
        success: boolean;
        data: { attendance: AttendancePerson[] };
      }>(`/attendance/${occurrenceId}/${type}`);
      return res.data.data.attendance;
    },
  );
}

/**
 * Prefetch person profiles and photos for all students and teachers in a class.
 * Reads student/teacher data from IndexedDB cache (populated in discovery phase).
 *
 * Two sub-phases:
 *   1. Profile data (tracked by the caller's fetchAndCache)
 *   2. Photos (progressTotal is extended here, tracked with the semaphore)
 */
async function _prefetchPersonDetails(classId: number): Promise<void> {
  const [studentsCached, teachersCached] = await Promise.all([
    getCached<Student[]>(classStudentsKey(classId)),
    getCached<Teacher[] | null>(classTeachersKey(classId)),
  ]);

  const allPeople: { id: number; type: "student" | "teacher" }[] = [];

  if (studentsCached?.data) {
    for (const s of studentsCached.data) {
      allPeople.push({ id: s.student_id, type: "student" });
    }
  }
  if (teachersCached?.data) {
    for (const t of teachersCached.data) {
      if (t) allPeople.push({ id: t.teacher_id, type: "teacher" });
    }
  }

  if (allPeople.length === 0) return;

  // Phase 1: Profile data (tracked by fetchAndCache)
  await Promise.allSettled(
    allPeople.map(({ id, type }) => _prefetchSingleProfileData(id, type)),
  );

  // Phase 2: Photos — count how many profiles have a photo_link
  let photoCount = 0;
  for (const { id, type } of allPeople) {
    const cached = await getCached<PersonProfile>(personProfileKey(id, type));
    if (cached?.data?.photo_link) photoCount++;
  }
  if (photoCount === 0) return;

  progressPhase = "جاري تحميل الصور الشخصية...";
  progressTotal += photoCount;
  progressCb?.({ loaded: progressLoaded, total: progressTotal, phase: progressPhase });

  const photoPromises = allPeople.map(async ({ id, type }) => {
    const cached = await getCached<PersonProfile>(personProfileKey(id, type));
    if (!cached?.data?.photo_link) return;
    await photoSem.acquire();
    try {
      await _prefetchPhoto(cached.data.photo_link);
    } finally {
      progressLoaded++;
      progressCb?.({ loaded: progressLoaded, total: progressTotal, phase: progressPhase });
      photoSem.release();
    }
  });

  await Promise.allSettled(photoPromises);
}

async function _prefetchSingleProfileData(
  personId: number,
  type: "student" | "teacher",
): Promise<void> {
  await fetchAndCache<PersonProfile>(
    personProfileKey(personId, type),
    async () => {
      const paramKey = type === "student" ? "students" : "teachers";
      const res = await prefetchApi.get<{ success: boolean; data: PersonProfile }>(
        `/persons/${paramKey}/${personId}`,
      );
      return res.data.data;
    },
  );
}

/**
 * Fetch a person's photo sizes and store them in Cache Storage so they're
 * available offline. Sizes are fetched sequentially within a single semaphore
 * slot to avoid connection-pool pressure.
 */
async function _prefetchPhoto(photoLink: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  if (!token) return;
  const sizes: ("sm" | "md")[] = ["sm", "md"];
  const cache = await caches.open("photo-cache");
  for (const size of sizes) {
    const url = getPhotoUrl(photoLink, size);
    if (!url) continue;
    try {
      const cached = await cache.match(url);
      if (cached) continue;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) continue;
      await cache.put(url, response);
    } catch {
      // Best-effort per size
    }
  }
}
