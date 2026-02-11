import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  BarChart3,
  Building2,
  Users,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  School,
  Calendar,
} from "lucide-react";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManagedSchool {
  school_id: number;
  school_name: string;
}

interface ClassInfo {
  class_id: number;
  class_name: string;
  school_name: string;
}

interface ReportsAccess {
  isManager: boolean;
  isLeader: boolean;
  isTeacher: boolean;
  managedSchools: ManagedSchool[];
  leaderClasses: ClassInfo[];
  teacherClasses: ClassInfo[];
}

interface AvailableDate {
  date: string;
  display_date: string;
}

interface BreakdownStat {
  person_type: string;
  total: number;
  attended: number;
  rate: number;
}

interface EventSummary {
  event_id: number;
  event_name: string;
  event_type: string;
  has_occurrence: boolean;
  breakdown: BreakdownStat[];
}

interface ClassSummaryData {
  class_id: number;
  class_name: string;
  school_name: string;
  date: string;
  events: EventSummary[];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader() {
  // Fetch access info and available dates in parallel
  const [accessRes, datesRes] = await Promise.all([
    api.get<{ success: boolean; data: ReportsAccess }>("/reports/access"),
    api.get<{ success: boolean; data: AvailableDate[] }>(
      "/reports/dates?limit=60"
    ),
  ]);

  const access = accessRes.data.data;
  const availableDates = datesRes.data.data;

  // Use the most recent available date, fall back to today
  const initialDate =
    availableDates.length > 0
      ? availableDates[0]!.date
      : new Date().toISOString().slice(0, 10);

  // Pre-fetch summaries for each class the user has access to
  const allClasses = new Map<number, ClassInfo>();
  for (const c of access.leaderClasses) allClasses.set(c.class_id, c);
  for (const c of access.teacherClasses) allClasses.set(c.class_id, c);

  const summaries: ClassSummaryData[] = [];

  if (availableDates.length > 0) {
    const classIds = Array.from(allClasses.keys());
    const summaryResults = await Promise.allSettled(
      classIds.map((classId) =>
        api.get<{ success: boolean; data: ClassSummaryData }>(
          `/reports/class/${classId}/summary?date=${initialDate}`
        )
      )
    );

    for (const result of summaryResults) {
      if (result.status === "fulfilled") {
        summaries.push(result.value.data.data);
      }
    }
  }

  return { access, summaries, availableDates, initialDate };
}

// ---------------------------------------------------------------------------
// Hydrate Fallback
// ---------------------------------------------------------------------------

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-5 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Reports({ loaderData }: Route.ComponentProps) {
  const { access, availableDates, initialDate } = loaderData;

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [summaries, setSummaries] = useState<ClassSummaryData[]>(
    loaderData.summaries
  );
  const [loading, setLoading] = useState(false);

  const hasNoAccess =
    !access.isManager && !access.isLeader && !access.isTeacher;

  // Collect all unique class IDs
  const allClasses = new Map<number, ClassInfo>();
  for (const c of access.leaderClasses) allClasses.set(c.class_id, c);
  for (const c of access.teacherClasses) allClasses.set(c.class_id, c);

  // Re-fetch summaries when date changes
  const fetchSummaries = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const classIds = Array.from(allClasses.keys());
        const summaryResults = await Promise.allSettled(
          classIds.map((classId) =>
            api.get<{ success: boolean; data: ClassSummaryData }>(
              `/reports/class/${classId}/summary?date=${date}`
            )
          )
        );
        const newSummaries: ClassSummaryData[] = [];
        for (const result of summaryResults) {
          if (result.status === "fulfilled") {
            newSummaries.push(result.value.data.data);
          }
        }
        setSummaries(newSummaries);
      } catch {
        // keep current data
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [access]
  );

  // Date navigation
  const dateIndex = availableDates.findIndex((d) => d.date === selectedDate);

  function goToPrevDate() {
    const nextIndex = dateIndex + 1;
    if (nextIndex < availableDates.length) {
      const newDate = availableDates[nextIndex]!.date;
      setSelectedDate(newDate);
      fetchSummaries(newDate);
    }
  }

  function goToNextDate() {
    const nextIndex = dateIndex - 1;
    if (nextIndex >= 0) {
      const newDate = availableDates[nextIndex]!.date;
      setSelectedDate(newDate);
      fetchSummaries(newDate);
    }
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    fetchSummaries(date);
  }

  const displayDate = formatDisplayDate(selectedDate);

  const summaryMap = new Map<number, ClassSummaryData>();
  for (const s of summaries) {
    summaryMap.set(s.class_id, s);
  }

  if (hasNoAccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <AlertTriangle className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">لا يوجد تقارير متاحة</h1>
        <p className="text-muted-foreground text-center">
          ليس لديك صلاحية للوصول لأي تقارير حالياً
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 className="size-7 text-primary" />
          <h1 className="text-2xl font-bold">التقارير</h1>
        </div>
        <p className="text-muted-foreground">متابعة حضور الخدمات والفصول</p>
      </div>

      {/* Date Picker */}
      {availableDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Calendar className="size-12 mb-4 opacity-30" />
          <p className="text-base font-medium mb-1">لا يوجد بيانات حضور</p>
          <p className="text-sm">لم يتم تسجيل أي حضور بعد</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={dateIndex >= availableDates.length - 1 || loading}
              onClick={goToPrevDate}
            >
              <ChevronRight className="size-4" />
            </Button>

            <Select value={selectedDate} onValueChange={handleDateSelect}>
              <SelectTrigger className="flex-1">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <SelectValue>{displayDate}</SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                {availableDates.map((d) => (
                  <SelectItem key={d.date} value={d.date}>
                    {formatDisplayDate(d.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={dateIndex <= 0 || loading}
              onClick={goToNextDate}
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          {/* Loading overlay */}
          {loading && (
            <div className="flex justify-center py-2">
              <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* Manager Section */}
          {access.isManager && access.managedSchools.length > 0 && (
            <section>
              <SectionHeader
                icon={Building2}
                title="إدارة المدارس"
                description="نظرة عامة على المدارس التي تديرها"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {access.managedSchools.map((school) => (
                  <ManagerSchoolCard
                    key={school.school_id}
                    school={school}
                    selectedDate={selectedDate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Leader / Admin Classes Section */}
          {access.leaderClasses.length > 0 && (
            <section>
              <SectionHeader
                icon={Users}
                title="الفصول (خادم / مشرف)"
                description="تقارير تفصيلية للفصول التي تشرف عليها"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {access.leaderClasses.map((cls) => (
                  <ClassReportCard
                    key={`leader-${cls.class_id}`}
                    cls={cls}
                    summary={summaryMap.get(cls.class_id)}
                    isLeader
                  />
                ))}
              </div>
            </section>
          )}

          {/* Teacher Classes Section */}
          {access.teacherClasses.length > 0 && (
            <section>
              <SectionHeader
                icon={GraduationCap}
                title="الفصول (خادم)"
                description="تقارير حضور المخدومين في فصولك"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {access.teacherClasses.map((cls) => (
                  <ClassReportCard
                    key={`teacher-${cls.class_id}`}
                    cls={cls}
                    summary={summaryMap.get(cls.class_id)}
                    isLeader={false}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <Icon className="size-5 text-muted-foreground mt-0.5" />
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manager School Card
// ---------------------------------------------------------------------------

function ManagerSchoolCard({
  school,
  selectedDate,
}: {
  school: ManagedSchool;
  selectedDate: string;
}) {
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<{
    school_name: string;
    classes: {
      class_id: number;
      class_name: string;
      events: {
        event_id: number;
        event_name: string;
        breakdown: BreakdownStat[];
      }[];
    }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(
        `/reports/school/${school.school_id}/comparison?date=${selectedDate}`
      )
      .then((res) => {
        if (!cancelled) setComparison(res.data.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [school.school_id, selectedDate]);

  const totalStudents = comparison
    ? comparison.classes.reduce((sum, cls) => {
        return (
          sum +
          cls.events.reduce((eSum, ev) => {
            const studentBreakdown = ev.breakdown.find(
              (b) => b.person_type === "student"
            );
            return eSum + (studentBreakdown?.total ?? 0);
          }, 0)
        );
      }, 0)
    : 0;

  const attendedStudents = comparison
    ? comparison.classes.reduce((sum, cls) => {
        return (
          sum +
          cls.events.reduce((eSum, ev) => {
            const studentBreakdown = ev.breakdown.find(
              (b) => b.person_type === "student"
            );
            return eSum + (studentBreakdown?.attended ?? 0);
          }, 0)
        );
      }, 0)
    : 0;

  const overallRate =
    totalStudents > 0
      ? Math.round((attendedStudents / totalStudents) * 100)
      : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <School className="size-5 text-primary" />
            <CardTitle className="text-base">{school.school_name}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            مدير
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : comparison && comparison.classes.length > 0 ? (
          <div className="flex flex-col gap-3">
            {/* Overall quick stat */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <span className="text-sm text-muted-foreground">
                حضور المخدومين
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  {attendedStudents}/{totalStudents}
                </span>
                <RateBadge rate={overallRate} />
              </div>
            </div>

            {/* Per-class mini list */}
            <div className="flex flex-col gap-1.5">
              {comparison.classes.slice(0, 4).map((cls) => {
                const studentTotal = cls.events.reduce((s, e) => {
                  const bd = e.breakdown.find(
                    (b) => b.person_type === "student"
                  );
                  return s + (bd?.total ?? 0);
                }, 0);
                const studentAttended = cls.events.reduce((s, e) => {
                  const bd = e.breakdown.find(
                    (b) => b.person_type === "student"
                  );
                  return s + (bd?.attended ?? 0);
                }, 0);
                const rate =
                  studentTotal > 0
                    ? Math.round((studentAttended / studentTotal) * 100)
                    : 0;

                return (
                  <Link
                    key={cls.class_id}
                    to={`/reports/class/${cls.class_id}`}
                    className="flex items-center justify-between text-sm hover:bg-accent rounded px-2 py-1.5 transition-colors"
                  >
                    <span className="truncate">{cls.class_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <MiniBar rate={rate} />
                      <span className="text-xs text-muted-foreground w-8 text-left">
                        {rate}%
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {comparison.classes.length > 4 && (
              <p className="text-xs text-muted-foreground text-center">
                + {comparison.classes.length - 4} فصول أخرى
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            لا يوجد بيانات حضور في هذا التاريخ
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Class Report Card
// ---------------------------------------------------------------------------

function ClassReportCard({
  cls,
  summary,
  isLeader,
}: {
  cls: ClassInfo;
  summary?: ClassSummaryData;
  isLeader: boolean;
}) {
  // Calculate total attendance from summary
  const studentBreakdowns = summary
    ? summary.events.flatMap((e) =>
        e.breakdown.filter((b) => b.person_type === "student")
      )
    : [];

  const totalStudents = studentBreakdowns.reduce((s, b) => s + b.total, 0);
  const attendedStudents = studentBreakdowns.reduce(
    (s, b) => s + b.attended,
    0
  );
  const studentRate =
    totalStudents > 0
      ? Math.round((attendedStudents / totalStudents) * 100)
      : 0;

  const teacherBreakdowns =
    isLeader && summary
      ? summary.events.flatMap((e) =>
          e.breakdown.filter((b) => b.person_type === "teacher")
        )
      : [];
  const totalTeachers = teacherBreakdowns.reduce((s, b) => s + b.total, 0);
  const attendedTeachers = teacherBreakdowns.reduce(
    (s, b) => s + b.attended,
    0
  );
  const teacherRate =
    totalTeachers > 0
      ? Math.round((attendedTeachers / totalTeachers) * 100)
      : 0;

  return (
    <Link to={`/reports/class/${cls.class_id}`}>
      <Card className="overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{cls.class_name}</CardTitle>
              <CardDescription className="text-xs">
                {cls.school_name}
              </CardDescription>
            </div>
            <ChevronLeft className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>
        <CardContent>
          {summary && summary.events.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* Student stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="size-4 text-muted-foreground" />
                  <span className="text-sm">المخدومين</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {attendedStudents}/{totalStudents}
                  </span>
                  <RateBadge rate={studentRate} />
                </div>
              </div>

              {/* Teacher stats (leader only) */}
              {isLeader && totalTeachers > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground" />
                    <span className="text-sm">الخدام</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {attendedTeachers}/{totalTeachers}
                    </span>
                    <RateBadge rate={teacherRate} />
                  </div>
                </div>
              )}

              {/* Per-event mini bars */}
              <div className="flex flex-col gap-1.5 mt-1">
                {summary.events.map((event) => {
                  const studentBd = event.breakdown.find(
                    (b) => b.person_type === "student"
                  );
                  const rate = studentBd?.rate ?? 0;
                  return (
                    <div
                      key={event.event_id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate text-muted-foreground">
                        {event.event_name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <MiniBar rate={rate} />
                        <span className="w-8 text-left text-muted-foreground">
                          {event.has_occurrence ? `${rate}%` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              لا يوجد بيانات حضور في هذا التاريخ
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Shared UI Components
// ---------------------------------------------------------------------------

function RateBadge({ rate }: { rate: number }) {
  let color: string;
  let Icon: React.ElementType;

  if (rate >= 75) {
    color =
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    Icon = TrendingUp;
  } else if (rate >= 50) {
    color =
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    Icon = Minus;
  } else {
    color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    Icon = TrendingDown;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        color
      )}
    >
      <Icon className="size-3" />
      {rate}%
    </span>
  );
}

function MiniBar({ rate }: { rate: number }) {
  let barColor: string;
  if (rate >= 75) {
    barColor = "bg-green-500";
  } else if (rate >= 50) {
    barColor = "bg-yellow-500";
  } else {
    barColor = "bg-red-500";
  }

  return (
    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          barColor
        )}
        style={{ width: `${rate}%` }}
      />
    </div>
  );
}

function formatDisplayDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    const days = [
      "الأحد",
      "الاثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${dayName} ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}