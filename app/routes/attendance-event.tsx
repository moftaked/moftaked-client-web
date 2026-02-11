import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useSearchFilter } from "~/contexts/search-context";
import api from "~/lib/api";
import type { Route } from "./+types/attendance-event";
import { Button } from "~/components/ui/button";
import {
  Loader2,
  Check,
  X,
  Users,
  GraduationCap,
  ArrowRight,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  type SyncStatus,
  getEndpoint,
  savePendingChanges,
  loadPendingChanges,
  clearPendingChanges,
  flushChanges,
} from "~/lib/attendance-sync";
import { fetchAndCache, isCacheStale, resetTimestampCache } from "~/lib/sync-manager";
import {
  classEventsKey,
  eventOccurrencesKey,
  occurrenceAttendanceKey,
  getCached,
  setCached,
  removeCached,
} from "~/lib/offline-db";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Event {
  event_id: number;
  event_name: string;
}

interface EventsData {
  studentEvents: Event[];
  teacherEvents: Event[];
}

type UserRole = "teacher" | "leader" | "manager";

interface Occurrence {
  event_occurence_id: number;
  occurence_date: string;
}

interface AttendancePerson {
  person_id: number;
  person_name: string;
  attended: number;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

interface CachedEventsData {
  studentEvents: Event[];
  teacherEvents: Event[];
  role: UserRole;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const classId = params.classId;
  const eventId = Number(params.eventId);

  // Fetch events (uses the same cache key as attendance-class page)
  const cachedEvents = await fetchAndCache<CachedEventsData>(
    classEventsKey(classId),
    async () => {
      const eventsRes = await api.get<{
        success: boolean;
        data: EventsData;
        role: UserRole;
      }>(`/events/classes/${classId}`);
      return {
        studentEvents: eventsRes.data.data.studentEvents,
        teacherEvents: eventsRes.data.data.teacherEvents,
        role: eventsRes.data.role,
      };
    }
  );

  const { studentEvents, teacherEvents, role } = cachedEvents;

  const hasStudents = studentEvents.some((e) => e.event_id === eventId);
  const hasTeachers = teacherEvents.some((e) => e.event_id === eventId);

  const allEvents = new Map<number, Event>();
  for (const e of studentEvents) allEvents.set(e.event_id, e);
  for (const e of teacherEvents) allEvents.set(e.event_id, e);

  const event = allEvents.get(eventId);

  // Fetch occurrences
  const occurrences = await fetchAndCache<Occurrence[]>(
    eventOccurrencesKey(eventId),
    async () => {
      const occRes = await api.get<{ success: boolean; data: Occurrence[] }>(
        `/events/${eventId}/occurrences`
      );
      return occRes.data.data;
    }
  );
  const latestOccurrence = occurrences.length > 0 ? occurrences[0] : null;

  return {
    classId,
    eventId,
    eventName: event?.event_name ?? "",
    hasStudents,
    hasTeachers,
    role,
    latestOccurrence,
  };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------


export default function AttendanceEvent({
  loaderData,
}: Route.ComponentProps) {
  const {
    classId,
    eventId,
    eventName,
    hasStudents,
    hasTeachers,
    role,
    latestOccurrence,
  } = loaderData;

  const navigate = useNavigate();
  const filterText = useSearchFilter();
  const isAdmin = role === "leader" || role === "manager";

  const defaultTab = hasStudents ? "student" : "teacher";
  const [activeTab, setActiveTab] = useState<"student" | "teacher">(defaultTab);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteOccurrence() {
    setDeleting(true);
    try {
      await api.delete("/events/occurrences", {
        data: { eventId, classId },
      });
      // Invalidate occurrence cache so fresh data is loaded on next visit
      resetTimestampCache();
      await removeCached(eventOccurrencesKey(eventId));
      navigate(`/attendance/${classId}`);
    } catch {
      setDeleting(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with back button and delete */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/attendance/${classId}`)}
        >
          <ArrowRight className="size-5" />
        </Button>
        <div className="flex flex-col grow">
          <h1 className="text-xl font-bold">{eventName}</h1>
          {latestOccurrence && (
            <span className="text-sm text-muted-foreground">
              {formatDate(latestOccurrence.occurence_date)}
            </span>
          )}
        </div>

        {/* Delete last occurrence — admin only */}
        {isAdmin && latestOccurrence && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف آخر جلسة؟</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم حذف آخر جلسة من &quot;{eventName}&quot; وكل بيانات الحضور
                  الخاصة بها. لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteOccurrence}>
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {!latestOccurrence ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          لا يوجد جلسات. أنشئ يوم جديد من صفحة الفصل لتسجيل الحضور.
        </p>
      ) : (
        <>
          {/* Student / teacher tab toggle */}
          {hasStudents && hasTeachers && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={activeTab === "student" ? "default" : "outline"}
                onClick={() => setActiveTab("student")}
                className="grow"
              >
                <GraduationCap className="size-4" />
                <span>مخدومين</span>
              </Button>
              <Button
                size="sm"
                variant={activeTab === "teacher" ? "default" : "outline"}
                onClick={() => setActiveTab("teacher")}
                className="grow"
              >
                <Users className="size-4" />
                <span>خدام</span>
              </Button>
            </div>
          )}

          {/* Attendance list */}
          <AttendanceList
            key={`${latestOccurrence.event_occurence_id}-${activeTab}`}
            eventOccurrenceId={latestOccurrence.event_occurence_id}
            type={activeTab}
            filterText={filterText}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sync Status Indicator
// ---------------------------------------------------------------------------

function SyncIndicator({ status }: { status: SyncStatus }) {
  switch (status) {
    case "synced":
      return (
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          <span className="text-xs">تم الحفظ</span>
        </div>
      );
    case "pending":
      return (
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <RefreshCw className="size-4" />
          <span className="text-xs">في انتظار الحفظ…</span>
        </div>
      );
    case "syncing":
      return (
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-xs">جاري الحفظ…</span>
        </div>
      );
    case "error":
      return (
        <div className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="size-4" />
          <span className="text-xs">فشل الحفظ — سيتم إعادة المحاولة</span>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Offline Banner
// ---------------------------------------------------------------------------

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
      <CloudOff className="size-4" />
      <span>لا يوجد اتصال — التغييرات محفوظة محلياً</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attendance List (offline-first with batched sync)
// ---------------------------------------------------------------------------

function AttendanceList({
  eventOccurrenceId,
  type,
  filterText = "",
}: {
  eventOccurrenceId: number;
  type: "student" | "teacher";
  filterText?: string;
}) {
  const [persons, setPersons] = useState<AttendancePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");

  // Accumulated changes since last successful flush: person_id → attended(1/0)
  const pendingRef = useRef<Record<number, number>>({});
  // We keep a "dirty" flag to avoid flushing when nothing changed
  const dirtyRef = useRef(false);
  // Track if component is mounted
  const mountedRef = useRef(true);
  // Interval id
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endpoint = getEndpoint(eventOccurrenceId, type);

  // ------- helpers that touch refs without triggering re-render -------

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSyncStatus("pending");
  }, []);

  const persistToStorage = useCallback(() => {
    savePendingChanges(eventOccurrenceId, type, pendingRef.current);
  }, [eventOccurrenceId, type]);

  // ------- flush logic -------

  const flush = useCallback(async (): Promise<boolean> => {
    const changes = { ...pendingRef.current };
    if (Object.keys(changes).length === 0) {
      // Nothing to flush
      if (mountedRef.current) setSyncStatus("synced");
      return true;
    }

    if (mountedRef.current) setSyncStatus("syncing");

    const success = await flushChanges(endpoint, changes);

    if (!mountedRef.current) return success;

    if (success) {
      // Remove only the changes we just flushed (new changes may have
      // accumulated while the request was in flight).
      const current = pendingRef.current;
      for (const key of Object.keys(changes)) {
        // Only delete if the value hasn't changed since we started flushing
        if (current[Number(key)] === changes[Number(key)]) {
          delete current[Number(key)];
        }
      }
      dirtyRef.current = Object.keys(current).length > 0;
      persistToStorage();

      if (Object.keys(current).length === 0) {
        setSyncStatus("synced");
        clearPendingChanges(eventOccurrenceId, type);
      } else {
        // Still have newer changes — keep pending
        setSyncStatus("pending");
      }

      return true;
    } else {
      // Failed — keep changes in storage for later retry
      persistToStorage();
      setSyncStatus("error");
      return false;
    }
  }, [endpoint, eventOccurrenceId, type, persistToStorage]);

  // ------- 1-second flush interval -------

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (dirtyRef.current) {
        dirtyRef.current = false; // reset so we don't double-flush
        flush();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [flush]);

  // ------- network restoration handler -------

  useEffect(() => {
    function handleOnline() {
      if (Object.keys(pendingRef.current).length > 0) {
        flush();
      }
    }

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flush]);

  // ------- flush on unmount (best-effort) -------

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Persist any remaining changes to localStorage so the global
      // provider can pick them up later.
      if (Object.keys(pendingRef.current).length > 0) {
        savePendingChanges(eventOccurrenceId, type, pendingRef.current);
        // Fire-and-forget flush attempt
        const ep = getEndpoint(eventOccurrenceId, type);
        flushChanges(ep, { ...pendingRef.current }).then((ok) => {
          if (ok) clearPendingChanges(eventOccurrenceId, type);
        });
      }
    };
  }, [eventOccurrenceId, type]);

  // ------- load data from API + merge localStorage overlay (offline-first) -------

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const cacheKey = occurrenceAttendanceKey(eventOccurrenceId, type);

    async function loadData() {
      let list: AttendancePerson[] | null = null;

      // 1. Try to load from IndexedDB cache first
      const cached = await getCached<AttendancePerson[]>(cacheKey);

      // 2. Check if cache is stale and fetch from API if needed
      const stale = await isCacheStale(cacheKey);
      if (!stale && cached) {
        list = cached.data;
      } else {
        try {
          const res = await api.get<{
            success: boolean;
            data: { attendance: AttendancePerson[]; date: unknown };
          }>(endpoint);
          list = res.data.data.attendance;
          // Cache the fresh attendance data
          await setCached(cacheKey, list);
        } catch {
          // Offline / error — fall back to cache
          if (cached) {
            list = cached.data;
          }
        }
      }

      if (cancelled || !list) return;

      // 3. Merge any pending changes from localStorage (offline queue)
      const stored = loadPendingChanges(eventOccurrenceId, type);
      if (Object.keys(stored).length > 0) {
        pendingRef.current = { ...stored };
        dirtyRef.current = true;
        setSyncStatus("pending");

        list = list.map((p) => {
          if (stored[p.person_id] !== undefined) {
            return { ...p, attended: stored[p.person_id] };
          }
          return p;
        });
      }

      setPersons(list);
    }

    loadData().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [endpoint, eventOccurrenceId, type]);

  // ------- toggle handler -------

  function toggleAttendance(person: AttendancePerson) {
    const newAttended = person.attended ? 0 : 1;

    // Optimistically update UI
    setPersons((prev) =>
      prev.map((p) =>
        p.person_id === person.person_id ? { ...p, attended: newAttended } : p
      )
    );

    // Accumulate change
    pendingRef.current[person.person_id] = newAttended;
    persistToStorage();
    markDirty();
  }

  // ------- render -------

  const filteredPersons = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter((p) => p.person_name.toLowerCase().includes(q));
  }, [persons, filterText]);

  const attendedCount = filteredPersons.filter((p) => p.attended).length;

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (persons.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-2">
        لا يوجد {type === "student" ? "مخدومين" : "خدام"} في هذا الفصل.
      </p>
    );
  }

  if (filteredPersons.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <OfflineBanner />
        <p className="text-muted-foreground text-sm text-center py-4">لا يوجد نتائج</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Offline banner */}
      <OfflineBanner />

      {/* Stats + sync indicator */}
      <div className="flex items-center justify-between px-2 py-1 text-sm text-muted-foreground">
        <span>
          الحضور: {attendedCount} / {filteredPersons.length}
        </span>
        <SyncIndicator status={syncStatus} />
      </div>

      {filteredPersons.map((person) => (
        <button
          key={person.person_id}
          type="button"
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-start",
            "hover:bg-accent active:bg-accent/80",
            person.attended
              ? "bg-primary/10 dark:bg-primary/20"
              : "bg-transparent"
          )}
          onClick={() => toggleAttendance(person)}
        >
          <div
            className={cn(
              "flex items-center justify-center size-8 rounded-full border-2 shrink-0 transition-colors",
              person.attended
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/40"
            )}
          >
            {person.attended ? (
              <Check className="size-4" />
            ) : (
              <X className="size-4 text-muted-foreground/40" />
            )}
          </div>
          <span className="text-base grow">{person.person_name}</span>
        </button>
      ))}
    </div>
  );
}