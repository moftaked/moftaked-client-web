import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useBlocker } from "react-router";
import { useSearchFilter } from "~/contexts/search-context";
import api from "~/lib/api";
import type { Route } from "./+types/attendance-event";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
  MessageSquareText,
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

type UserRole = "teacher" | "leader" | "manager" | "admin";

interface Occurrence {
  event_occurence_id: number;
  occurence_date: string;
}

interface AttendancePerson {
  person_id: number;
  person_name: string;
  attended: number;
  absence_reason?: string | null;
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
  const isAdmin = role === "leader" || role === "manager" || role === "admin";

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
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `\u200E${day}/${month}/${year}`;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with back button and delete */}
      <div className="flex items-center gap-3">
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
  // Accumulated reasons for absent people: person_id → reason text
  const reasonsRef = useRef<Record<number, string>>({});
  // Which person's reason field is currently expanded
  const [reasonExpanded, setReasonExpanded] = useState<Record<number, boolean>>({});
  // Whether a textarea currently has unsaved content (for navigation guard)
  const unsavedRef = useRef(false);
  // We keep a "dirty" flag to avoid flushing when nothing changed
  const dirtyRef = useRef(false);
  // Track if component is mounted
  const mountedRef = useRef(true);
  // Interval id
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endpoint = getEndpoint(eventOccurrenceId, type);

  // ------- navigation guard -------

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname && unsavedRef.current
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      const leave = window.confirm(
        "لديك تغييرات غير محفوظة في سبب الغياب. هل تريد المغادرة؟"
      );
      if (leave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (unsavedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ------- helpers that touch refs without triggering re-render -------

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSyncStatus("pending");
  }, []);

  const persistToStorage = useCallback(() => {
    savePendingChanges(eventOccurrenceId, type, pendingRef.current, reasonsRef.current);
  }, [eventOccurrenceId, type]);

  // ------- flush logic -------

  const flush = useCallback(async (): Promise<boolean> => {
    const changes = { ...pendingRef.current };
    const reasons = { ...reasonsRef.current };
    if (Object.keys(changes).length === 0 && Object.keys(reasons).length === 0) {
      if (mountedRef.current) setSyncStatus("synced");
      return true;
    }

    if (mountedRef.current) setSyncStatus("syncing");

    const success = await flushChanges(endpoint, changes, reasons);

    if (!mountedRef.current) return success;

    if (success) {
      const currentPending = pendingRef.current;
      const currentReasons = reasonsRef.current;

      // Clear flushed attendance toggles
      for (const key of Object.keys(changes)) {
        const id = Number(key);
        if (currentPending[id] === changes[id]) {
          delete currentPending[id];
        }
      }

      // Clear flushed reasons (only those that haven't changed since flush)
      for (const key of Object.keys(reasons)) {
        const id = Number(key);
        if (currentReasons[id] === reasons[id]) {
          delete currentReasons[id];
        }
      }

      dirtyRef.current = Object.keys(currentPending).length > 0;
      persistToStorage();

      if (Object.keys(currentPending).length === 0 && Object.keys(currentReasons).length === 0) {
        setSyncStatus("synced");
        clearPendingChanges(eventOccurrenceId, type);
      } else {
        setSyncStatus("pending");
      }

      // Invalidate attendance cache so fresh data is fetched on next mount
      removeCached(occurrenceAttendanceKey(eventOccurrenceId, type));

      return true;
    } else {
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
      if (Object.keys(pendingRef.current).length > 0) {
        savePendingChanges(eventOccurrenceId, type, pendingRef.current, reasonsRef.current);
        const ep = getEndpoint(eventOccurrenceId, type);
        flushChanges(ep, { ...pendingRef.current }, { ...reasonsRef.current }).then((ok) => {
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
      if (Object.keys(stored.changes).length > 0 || Object.keys(stored.reasons).length > 0) {
        pendingRef.current = { ...stored.changes };
        reasonsRef.current = { ...stored.reasons };
        dirtyRef.current = true;
        setSyncStatus("pending");

        list = list.map((p) => {
          let updated = { ...p };
          if (stored.changes[p.person_id] !== undefined) {
            updated.attended = stored.changes[p.person_id];
          }
          if (!updated.attended && stored.reasons[p.person_id]) {
            updated.absence_reason = stored.reasons[p.person_id];
          }
          return updated;
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

  // ------- toggle attendance (circle click) -------

  function handleToggleAttendance(person: AttendancePerson) {
    const id = person.person_id;
    const newAttended = person.attended ? 0 : 1;

    setPersons((prev) =>
      prev.map((p) =>
        p.person_id === id ? { ...p, attended: newAttended, absence_reason: newAttended ? null : p.absence_reason } : p
      )
    );

    pendingRef.current[id] = newAttended;

    if (newAttended) {
      delete reasonsRef.current[id];
      setReasonExpanded((prev) => ({ ...prev, [id]: false }));
    }

    persistToStorage();
    markDirty();
  }

  // ------- reason editor (name click, only when absent) -------

  function handleOpenReason(personId: number) {
    setReasonExpanded((prev) => {
      const current = prev[personId] ?? false;
      return { ...prev, [personId]: !current };
    });
  }

  // ------- reason save / mark present -------

  function handleReasonChange(personId: number, reason: string) {
    unsavedRef.current = true;
    setPersons((prev) =>
      prev.map((p) =>
        p.person_id === personId ? { ...p, absence_reason: reason } : p
      )
    );
  }

  function handleReasonBlur(personId: number, reason: string) {
    reasonsRef.current[personId] = reason;
    persistToStorage();

    if (reason) {
      markDirty();
    } else {
      delete reasonsRef.current[personId];
      persistToStorage();
    }

    unsavedRef.current = false;
  }

  function handleMarkPresent(personId: number) {
    setPersons((prev) =>
      prev.map((p) =>
        p.person_id === personId ? { ...p, attended: 1, absence_reason: null } : p
      )
    );

    pendingRef.current[personId] = 1;
    delete reasonsRef.current[personId];
    persistToStorage();
    markDirty();

    setReasonExpanded((prev) => ({ ...prev, [personId]: false }));
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

      {filteredPersons.map((person) => {
        const isExpanded = reasonExpanded[person.person_id] ?? false;
        const hasReason = !!(
          !person.attended &&
          (reasonsRef.current[person.person_id] || person.absence_reason)
        );
        const displayReason =
          reasonsRef.current[person.person_id] ?? person.absence_reason ?? "";

        return (
          <div
            key={person.person_id}
            className={cn(
              "rounded-lg transition-colors",
              person.attended
                ? "bg-primary/10 dark:bg-primary/20"
                : "bg-transparent"
            )}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center size-8 rounded-full border-2 shrink-0 transition-colors",
                  person.attended
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40 hover:bg-muted-foreground/10"
                )}
                onClick={() => handleToggleAttendance(person)}
              >
                {person.attended ? (
                  <Check className="size-4" />
                ) : (
                  <X className="size-4 text-muted-foreground/40" />
                )}
              </button>

              <button
                type="button"
                className={cn(
                  "text-base text-start grow rounded px-1 -mx-1 transition-colors",
                  !person.attended && "hover:bg-accent"
                )}
                onClick={() => {
                  if (!person.attended) handleOpenReason(person.person_id);
                }}
              >
                <span>{person.person_name}</span>
                {hasReason && !isExpanded && (
                  <MessageSquareText className="size-3.5 text-muted-foreground/60 inline mr-1.5" />
                )}
              </button>
            </div>

            {!person.attended && isExpanded && (
              <div className="px-12 pb-3 pt-0 flex flex-col gap-2">
                <Input
                  placeholder="سبب الغياب (اختياري)"
                  className="text-sm"
                  dir="rtl"
                  defaultValue={displayReason}
                  onFocus={() => { unsavedRef.current = true; }}
                  onChange={(e) => handleReasonChange(person.person_id, e.target.value)}
                  onBlur={(e) => handleReasonBlur(person.person_id, e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs self-start"
                  onClick={() => setReasonExpanded((prev) => ({ ...prev, [person.person_id]: false }))}
                >
                  تم
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}