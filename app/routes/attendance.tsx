import { useState } from "react";
import type { Route } from "./+types/attendance";
import api from "~/lib/api";
import { fetchAndCache, forceFetchAndCache, resetTimestampCache } from "~/lib/sync-manager";
import { CLASSES_KEY, classEventsKey, eventOccurrencesKey, removeCached } from "~/lib/offline-db";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  async function handleNewDay(dateStr: string) {
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; eventIds: number[] }>(
        "/events/occurrences/school",
        { schoolId: school.school_id, date: dateStr }
      );

      // Invalidate occurrence caches so downstream pages load fresh data
      resetTimestampCache();

      const eventIds = res.data.eventIds ?? [];

      if (eventIds.length === 0) {
        toast.error("لا يوجد فعاليات في هذه المدرسة");
        setLoading(false);
        return;
      }

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
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 shrink-0"
        disabled={loading || done}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDialogOpen(true);
        }}
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

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">إضافة يوم جديد</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              اختر تاريخ يوم الحضور الجديد لتسجيله للمدرسة بالكامل:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4" onClick={(e) => e.stopPropagation()}>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <AlertDialogFooter className="flex-row gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDialogOpen(false);
              }}
            >
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDialogOpen(false);
                handleNewDay(selectedDate);
              }}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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