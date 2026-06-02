import { useState } from "react";
import type { Route } from "./+types/attendance";
import api from "~/lib/api";
import { fetchAndCache, forceFetchAndCache, resetTimestampCache } from "~/lib/sync-manager";
import { CLASSES_KEY, classEventsKey, eventOccurrencesKey, removeCached } from "~/lib/offline-db";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { ClassPicker, type SchoolWithClasses } from "~/components/class-picker";
import { CalendarPlus, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

async function fetchSchools() {
  const res = await api.get<SchoolWithClasses[]>("/classes");
  return res.data;
}

export async function clientLoader() {
  let schools = await fetchAndCache<SchoolWithClasses[]>(
    CLASSES_KEY,
    fetchSchools,
  );

  // If the cached data is missing the `role` field (stale cache from before
  // the server started returning it), force a fresh fetch.
  if (schools.length > 0 && schools[0].role === undefined) {
    schools = await forceFetchAndCache<SchoolWithClasses[]>(
      CLASSES_KEY,
      fetchSchools,
    );
  }

  return { schools };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-5 w-56" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Skeleton className="h-18 w-full rounded-xl" />
        <Skeleton className="h-18 w-full rounded-xl" />
        <Skeleton className="h-18 w-full rounded-xl" />
      </div>
    </div>
  );
}

function NewDayButton({ school }: { school: SchoolWithClasses }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleNewDay(e: React.MouseEvent) {
    // Prevent the click from propagating to any parent Link
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; eventIds: number[] }>(
        "/events/occurrences/school",
        { schoolId: school.school_id }
      );

      // Invalidate occurrence caches so downstream pages load fresh data
      resetTimestampCache();

      const eventIds = res.data.eventIds ?? [];
      await Promise.all(
        eventIds.map((eid) => removeCached(eventOccurrencesKey(eid)))
      );

      await Promise.all(
        school.classes.map((cls) => removeCached(classEventsKey(cls.class_id)))
      );

      setDone(true);
      toast.success("تم إنشاء يوم جديد");
    } catch {
      toast.error("حدث خطأ أثناء إنشاء يوم جديد");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5 shrink-0"
      disabled={loading || done}
      onClick={handleNewDay}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : done ? (
        <Check className="size-4" />
      ) : (
        <CalendarPlus className="size-4" />
      )}
      <span>{done ? "تم" : "يوم جديد"}</span>
    </Button>
  );
}

export default function Attendance({ loaderData }: Route.ComponentProps) {
  const { schools } = loaderData;

  const isSchoolAdmin = (school: SchoolWithClasses) =>
    school.role === "leader" || school.role === "manager" || school.role === "admin";

  // If there's only one school and the user is admin, show a top-level new day button
  const singleSchool = schools.length === 1 ? schools[0] : null;
  const showTopButton = singleSchool && isSchoolAdmin(singleSchool);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">تسجيل الحضور</h1>
          <p className="text-muted-foreground mt-1">اختر الفصل لتسجيل الحضور</p>
        </div>
        {showTopButton && <NewDayButton school={singleSchool} />}
      </div>
      <ClassPicker
        schools={schools}
        linkPrefix="/attendance/"
        schoolAction={(school) =>
          isSchoolAdmin(school) ? <NewDayButton school={school} /> : null
        }
      />
    </div>
  );
}