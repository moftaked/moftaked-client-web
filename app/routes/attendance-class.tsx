import { useState } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/attendance-class";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Loader2,
  CalendarPlus,
  ChevronLeft,
} from "lucide-react";
import { fetchAndCache, resetTimestampCache } from "~/lib/sync-manager";
import { classEventsKey, eventOccurrencesKey, removeCached } from "~/lib/offline-db";

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
  const cached = await fetchAndCache<CachedEventsData>(
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
  return {
    classId,
    studentEvents: cached.studentEvents,
    teacherEvents: cached.teacherEvents,
    role: cached.role,
  };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AttendanceClass({ loaderData }: Route.ComponentProps) {
  const { classId, studentEvents, teacherEvents, role } = loaderData;
  const isAdmin = role === "leader" || role === "manager";

  const allEvents = new Map<number, Event>();
  for (const e of studentEvents) allEvents.set(e.event_id, e);
  for (const e of teacherEvents) allEvents.set(e.event_id, e);

  const uniqueEvents = Array.from(allEvents.values());

  const [creatingDay, setCreatingDay] = useState(false);

  async function handleNewDay() {
    setCreatingDay(true);
    try {
      await Promise.all(
        uniqueEvents.map((event) =>
          api.post("/events/occurrences", { eventId: event.event_id })
        )
      );
      // Invalidate occurrence caches so fresh data is loaded after reload
      resetTimestampCache();
      await Promise.all(
        uniqueEvents.map((event) =>
          removeCached(eventOccurrencesKey(event.event_id))
        )
      );
      // Force a page reload to reflect new occurrences
      window.location.reload();
    } catch {
      setCreatingDay(false);
    }
  }

  if (uniqueEvents.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">تسجيل الحضور</h1>
        <p className="text-muted-foreground">لا يوجد غياب في هذا الفصل</p>
        {isAdmin && (
          <Button onClick={handleNewDay} disabled={creatingDay} className="gap-2">
            {creatingDay ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CalendarPlus className="size-5" />
            )}
            <span>يوم جديد</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">تسجيل الحضور</h1>
        {isAdmin && (
          <Button onClick={handleNewDay} disabled={creatingDay} className="gap-2">
            {creatingDay ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CalendarPlus className="size-5" />
            )}
            <span>يوم جديد</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {uniqueEvents.map((event) => (
          <div
            key={event.event_id}
            className="border rounded-xl overflow-hidden"
          >
            <Link
              to={`/attendance/${classId}/event/${event.event_id}`}
              className="flex items-center justify-between px-4 py-4 hover:bg-accent active:bg-accent/80 transition-colors"
            >
              <span className="text-lg font-bold">{event.event_name}</span>
              <ChevronLeft className="size-5 text-muted-foreground" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}