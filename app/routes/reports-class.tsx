import axios from "axios";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, redirect } from "react-router";
import api from "~/lib/api";
import { useReportsDate } from "~/contexts/reports-date-context";
import type { Route } from "./+types/reports-class";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Phone,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  UserX,
  AlertTriangle,
  MapPin,
  LineChart,
} from "lucide-react";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreakdownStat {
  person_type: string;
  total: number;
  attended: number;
  absent: number;
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

interface AvailableDate {
  date: string;
  display_date: string;
}

interface AbsenteePerson {
  person_id: number;
  person_name: string;
  phone_numbers: string | null;
  district_name: string | null;
}

interface AbsenteesData {
  class_id: number;
  event_id: number;
  date: string;
  students: AbsenteePerson[];
  teachers: AbsenteePerson[];
  total_absent_students: number;
  total_absent_teachers: number;
}

interface ChronicAbsentee {
  person_id: number;
  person_name: string;
  event_id: number;
  event_name: string;
  total_occurrences: number;
  attended_count: number;
  rate: number;
  phone_numbers: string | null;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const classId = params.classId;

  let availableDates: AvailableDate[] = [];
  let summary: ClassSummaryData | null = null;
  let role = "teacher";

  try {
    const datesRes = await api.get<{ success: boolean; data: AvailableDate[] }>(
      `/reports/class/${classId}/dates?limit=60`
    );
    availableDates = datesRes.data.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      throw redirect("/reports");
    }
    throw err;
  }

  const initialDate =
    availableDates.length > 0
      ? availableDates[0]!.date
      : new Date().toISOString().slice(0, 10);

  if (availableDates.length > 0) {
    try {
      const summaryRes = await api.get<{
        success: boolean;
        data: ClassSummaryData;
        role: string;
      }>(`/reports/class/${classId}/summary?date=${initialDate}`);
      summary = summaryRes.data.data;
      role = summaryRes.data.role;
    } catch {
      // keep summary as null
    }
  }

  return {
    classId,
    summary,
    role,
    availableDates,
    initialDate,
  };
}

// ---------------------------------------------------------------------------
// Hydrate Fallback
// ---------------------------------------------------------------------------

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-7 w-48" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ReportsClass({ loaderData }: Route.ComponentProps) {
  const { classId, role, availableDates, initialDate } = loaderData;
  const navigate = useNavigate();
  const reportsDate = useReportsDate();

  // Use context date if it exists in this class's available dates, otherwise fall back to loader's initialDate
  const contextDateValid = !!reportsDate.selectedDate && availableDates.some((d) => d.date === reportsDate.selectedDate);
  const resolvedInitialDate = contextDateValid ? reportsDate.selectedDate : initialDate;

  const [selectedDate, setSelectedDateLocal] = useState(resolvedInitialDate);
  const [summary, setSummary] = useState<ClassSummaryData | null>(
    // If context date differs from loader date, summary will be refetched in useEffect below
    loaderData.summary
  );
  const [loading, setLoading] = useState(contextDateValid && reportsDate.selectedDate !== initialDate);
  const [activeTab, setActiveTab] = useState("overview");
  const [absentees, setAbsentees] = useState<Map<number, AbsenteesData>>(
    new Map()
  );
  const [absenteesLoading, setAbsenteesLoading] = useState<Set<number>>(
    new Set()
  );
  const [chronicAbsentees, setChronicAbsentees] = useState<
    ChronicAbsentee[] | null
  >(null);
  const [chronicLoading, setChronicLoading] = useState(false);

  const isLeaderOrManager = role === "leader" || role === "manager" || role === "admin";

  // Sync selected date back to context
  const setSelectedDate = useCallback(
    (date: string) => {
      setSelectedDateLocal(date);
      reportsDate.setSelectedDate(date);
    },
    [reportsDate]
  );

  // Fetch summary for a new date
  const fetchSummary = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const res = await api.get<{
          success: boolean;
          data: ClassSummaryData;
        }>(`/reports/class/${classId}/summary?date=${date}`);
        setSummary(res.data.data);
        // Clear absentees cache when date changes
        setAbsentees(new Map());
      } catch {
        // keep current data
      } finally {
        setLoading(false);
      }
    },
    [classId]
  );

  // If the resolved initial date differs from what the loader fetched, re-fetch
  const hasFetchedForContext = useRef(false);
  useEffect(() => {
    if (!hasFetchedForContext.current && resolvedInitialDate !== initialDate) {
      hasFetchedForContext.current = true;
      fetchSummary(resolvedInitialDate);
    }
  }, [resolvedInitialDate, initialDate, fetchSummary]);

  // Navigate dates
  const dateIndex = availableDates.findIndex((d) => d.date === selectedDate);

  function goToPrevDate() {
    const nextIndex = dateIndex + 1;
    if (nextIndex < availableDates.length) {
      const newDate = availableDates[nextIndex]!.date;
      setSelectedDate(newDate);
      fetchSummary(newDate);
    }
  }

  function goToNextDate() {
    const nextIndex = dateIndex - 1;
    if (nextIndex >= 0) {
      const newDate = availableDates[nextIndex]!.date;
      setSelectedDate(newDate);
      fetchSummary(newDate);
    }
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    fetchSummary(date);
  }

  // Fetch absentees for a specific event
  async function fetchAbsentees(eventId: number) {
    if (absentees.has(eventId) || absenteesLoading.has(eventId)) return;
    setAbsenteesLoading((prev) => new Set(prev).add(eventId));
    try {
      const res = await api.get<{ success: boolean; data: AbsenteesData }>(
        `/reports/class/${classId}/absentees?date=${selectedDate}&eventId=${eventId}`
      );
      setAbsentees((prev) => {
        const next = new Map(prev);
        next.set(eventId, res.data.data);
        return next;
      });
    } catch {
      // ignore
    } finally {
      setAbsenteesLoading((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  }

  // Fetch chronic absentees
  useEffect(() => {
    if (!isLeaderOrManager || activeTab !== "chronic") return;
    if (chronicAbsentees !== null) return;
    setChronicLoading(true);
    api
      .get<{ success: boolean; data: ChronicAbsentee[] }>(
        `/reports/class/${classId}/chronic-absentees?type=student&threshold=50&last=5`
      )
      .then((res) => setChronicAbsentees(res.data.data))
      .catch(() => setChronicAbsentees([]))
      .finally(() => setChronicLoading(false));
  }, [classId, activeTab, isLeaderOrManager, chronicAbsentees]);

  // Computed stats
  const allStudentBreakdowns = (summary?.events ?? []).flatMap((e) =>
    e.breakdown.filter((b) => b.person_type === "student")
  );
  const totalStudents = allStudentBreakdowns.reduce(
    (s, b) => s + b.total,
    0
  );
  const attendedStudents = allStudentBreakdowns.reduce(
    (s, b) => s + b.attended,
    0
  );
  const studentRate =
    totalStudents > 0
      ? Math.round((attendedStudents / totalStudents) * 100)
      : 0;

  const allTeacherBreakdowns = (summary?.events ?? []).flatMap((e) =>
    e.breakdown.filter((b) => b.person_type === "teacher")
  );
  const totalTeachers = allTeacherBreakdowns.reduce(
    (s, b) => s + b.total,
    0
  );
  const attendedTeachers = allTeacherBreakdowns.reduce(
    (s, b) => s + b.attended,
    0
  );
  const teacherRate =
    totalTeachers > 0
      ? Math.round((attendedTeachers / totalTeachers) * 100)
      : 0;

  const displayDate = formatDisplayDate(selectedDate);

  return (
    <div className="flex flex-col gap-5">
      {/* Header with back nav */}
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">
            تقرير {summary?.class_name ?? "الفصل"}
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {summary?.school_name ?? ""}
          </p>
        </div>
      </div>

      {/* No available dates */}
      {availableDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Calendar className="size-12 mb-4 opacity-30" />
          <p className="text-base font-medium mb-1">لا يوجد بيانات حضور</p>
          <p className="text-sm">لم يتم تسجيل أي حضور في هذا الفصل بعد</p>
        </div>
      ) : (
        <>
          {/* Date navigation */}
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

          {summary && (
            <>
              {/* Quick Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <QuickStatCard
                  icon={GraduationCap}
                  label="المخدومين"
                  attended={attendedStudents}
                  total={totalStudents}
                  rate={studentRate}
                />
                {isLeaderOrManager && totalTeachers > 0 && (
                  <QuickStatCard
                    icon={Users}
                    label="الخدام"
                    attended={attendedTeachers}
                    total={totalTeachers}
                    rate={teacherRate}
                  />
                )}
              </div>

              {/* Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-2 md:grid-cols-3">
                  <TabsTrigger value="overview" className="text-xs sm:text-sm">
                    <BarChart3 className="size-4 ml-1.5" />
                    ملخص
                  </TabsTrigger>
                  {isLeaderOrManager && (
                    <TabsTrigger value="absentees" className="text-xs sm:text-sm">
                      <UserX className="size-4 ml-1.5" />
                      الغائبين
                    </TabsTrigger>
                  )}
                  {isLeaderOrManager && (
                    <TabsTrigger value="chronic" className="text-xs sm:text-sm">
                      <AlertTriangle className="size-4 ml-1.5" />
                      المنقطعين
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* ---- Overview Tab ---- */}
                <TabsContent value="overview" className="mt-4">
                  {summary.events.length === 0 ? (
                    <EmptyState message="لا يوجد غياب في هذا التاريخ" />
                  ) : (
                    <div className="flex flex-col gap-4">
                      {summary.events.map((event) => (
                        <EventSummaryCard
                          key={event.event_id}
                          event={event}
                          classId={classId}
                          isLeader={isLeaderOrManager}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ---- Absentees Tab ---- */}
                {isLeaderOrManager && (
                  <TabsContent value="absentees" className="mt-4">
                    {summary.events.length === 0 ? (
                      <EmptyState message="لا يوجد غياب في هذا التاريخ" />
                    ) : (
                      <div className="flex flex-col gap-4">
                        {summary.events.map((event) => (
                          <AbsenteesPanel
                            key={event.event_id}
                            event={event}
                            data={absentees.get(event.event_id)}
                            loading={absenteesLoading.has(event.event_id)}
                            onLoad={() => fetchAbsentees(event.event_id)}
                            classId={classId}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                )}

                {/* ---- Chronic Absentees Tab ---- */}
                {isLeaderOrManager && (
                  <TabsContent value="chronic" className="mt-4">
                    <ChronicAbsenteesPanel
                      data={chronicAbsentees}
                      loading={chronicLoading}
                      classId={classId}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Stat Card
// ---------------------------------------------------------------------------

function QuickStatCard({
  icon: Icon,
  label,
  attended,
  total,
  rate,
}: {
  icon: React.ElementType;
  label: string;
  attended: number;
  total: number;
  rate: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold">{attended}</span>
            <span className="text-sm text-muted-foreground">/{total}</span>
          </div>
          <RateBadge rate={rate} />
        </div>
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              rateColor(rate)
            )}
            style={{ width: `${rate}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Event Summary Card
// ---------------------------------------------------------------------------

function EventSummaryCard({
  event,
  classId,
  isLeader,
}: {
  event: EventSummary;
  classId: string;
  isLeader: boolean;
}) {
  const studentBd = event.breakdown.find((b) => b.person_type === "student");
  const teacherBd = event.breakdown.find((b) => b.person_type === "teacher");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{event.event_name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {event.event_type === "all"
                ? "الكل"
                : event.event_type === "student"
                ? "مخدومين"
                : "خدام"}
            </Badge>
            <Link
              to={`/reports/class/${classId}/event/${event.event_id}`}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <LineChart className="size-4" />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!event.has_occurrence ? (
          <p className="text-sm text-muted-foreground">
            لا يوجد حضور مسجل في هذا التاريخ
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Student breakdown */}
            {studentBd && (
              <BreakdownRow
                label="المخدومين"
                icon={GraduationCap}
                attended={studentBd.attended}
                total={studentBd.total}
                rate={studentBd.rate}
              />
            )}

            {/* Teacher breakdown (leader only) */}
            {isLeader && teacherBd && (
              <BreakdownRow
                label="الخدام"
                icon={Users}
                attended={teacherBd.attended}
                total={teacherBd.total}
                rate={teacherBd.rate}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Breakdown Row
// ---------------------------------------------------------------------------

function BreakdownRow({
  label,
  icon: Icon,
  attended,
  total,
  rate,
}: {
  label: string;
  icon: React.ElementType;
  attended: number;
  total: number;
  rate: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {attended}/{total}
          </span>
          <RateBadge rate={rate} />
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            rateColor(rate)
          )}
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Absentees Panel
// ---------------------------------------------------------------------------

function AbsenteesPanel({
  event,
  data,
  loading,
  onLoad,
  classId,
}: {
  event: EventSummary;
  data?: AbsenteesData;
  loading: boolean;
  onLoad: () => void;
  classId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  function handleToggle() {
    if (!expanded && !data) {
      onLoad();
    }
    setExpanded(!expanded);
  }

  const studentBd = event.breakdown.find((b) => b.person_type === "student");
  const absentCount = studentBd ? studentBd.total - studentBd.attended : 0;

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={handleToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{event.event_name}</CardTitle>
            {event.has_occurrence && absentCount > 0 && (
              <Badge
                variant="destructive"
                className="text-xs"
              >
                {absentCount} غائب
              </Badge>
            )}
          </div>
          <ChevronLeft
            className={cn(
              "size-5 text-muted-foreground transition-transform",
              expanded && "-rotate-90"
            )}
          />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {!event.has_occurrence ? (
            <p className="text-sm text-muted-foreground">
              لا يوجد حضور مسجل في هذا التاريخ
            </p>
          ) : loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : data ? (
            <div className="flex flex-col gap-4">
              {/* Absent Students */}
              {data.students.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <GraduationCap className="size-4 text-muted-foreground" />
                    مخدومين غائبين ({data.total_absent_students})
                  </h4>
                  <AbsenteeTable
                    persons={data.students}
                    type="student"
                    classId={classId}
                  />
                </div>
              )}

              {/* Absent Teachers */}
              {data.teachers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground" />
                    خدام غائبين ({data.total_absent_teachers})
                  </h4>
                  <AbsenteeTable
                    persons={data.teachers}
                    type="teacher"
                    classId={classId}
                  />
                </div>
              )}

              {data.students.length === 0 && data.teachers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  🎉 الكل حاضر!
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Absentee Table
// ---------------------------------------------------------------------------

function AbsenteeTable({
  persons,
  type,
  classId,
}: {
  persons: AbsenteePerson[];
  type: string;
  classId: string;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">الاسم</TableHead>
            <TableHead className="text-right">المنطقة</TableHead>
            <TableHead className="text-right">الهاتف</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {persons.map((person) => (
            <TableRow key={person.person_id}>
              <TableCell>
                <Link
                  to={`/reports/person/${type}/${person.person_id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {person.person_name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {person.district_name ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {person.district_name}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {person.phone_numbers ? (
                  <a
                    href={`tel:${person.phone_numbers.split(",")[0]?.trim()}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="size-3" />
                    <span className="text-xs" dir="ltr">
                      {person.phone_numbers.split(",")[0]?.trim()}
                    </span>
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chronic Absentees Panel
// ---------------------------------------------------------------------------

function ChronicAbsenteesPanel({
  data,
  loading,
  classId,
}: {
  data: ChronicAbsentee[] | null;
  loading: boolean;
  classId: string;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState message="لا يوجد مخدومين منقطعين (حضور أقل من 50% في آخر 5 مرات)" />
    );
  }

  // Group by person
  const grouped = new Map<
    number,
    {
      person_id: number;
      person_name: string;
      phone_numbers: string | null;
      events: {
        event_id: number;
        event_name: string;
        rate: number;
        attended: number;
        total: number;
      }[];
    }
  >();

  for (const item of data) {
    let person = grouped.get(item.person_id);
    if (!person) {
      person = {
        person_id: item.person_id,
        person_name: item.person_name,
        phone_numbers: item.phone_numbers,
        events: [],
      };
      grouped.set(item.person_id, person);
    }
    person.events.push({
      event_id: item.event_id,
      event_name: item.event_name,
      rate: item.rate,
      attended: item.attended_count,
      total: item.total_occurrences,
    });
  }

  const persons = Array.from(grouped.values());

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        المخدومين اللي حضورهم أقل من 50% في آخر 5 مرات
      </p>

      <div className="flex flex-col gap-3">
        {persons.map((person) => (
          <Card key={person.person_id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Link
                    to={`/reports/person/student/${person.person_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {person.person_name}
                  </Link>
                </div>
                {person.phone_numbers && (
                  <a
                    href={`tel:${person.phone_numbers.split(",")[0]?.trim()}`}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                  >
                    <Phone className="size-3" />
                    <span dir="ltr" className="text-xs">
                      {person.phone_numbers.split(",")[0]?.trim()}
                    </span>
                  </a>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {person.events.map((ev) => (
                  <div
                    key={ev.event_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground truncate">
                      {ev.event_name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {ev.attended}/{ev.total}
                      </span>
                      <RateBadge rate={ev.rate} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared UI
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

function rateColor(rate: number): string {
  if (rate >= 75) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <BarChart3 className="size-10 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
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