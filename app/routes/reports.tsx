import { useState, useEffect, useCallback, useMemo } from "react";
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
      "/reports/dates"
    ),
  ]);

  const access = accessRes.data.data;
  const availableDates = datesRes.data.data;

  // todo: display no data screen if no available dates
  if (availableDates.length === 0) return;
  const initialDate = availableDates[0]!.date;

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
  if(!loaderData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calendar className="size-12 mb-4 opacity-30" />
        <p className="text-base font-medium mb-1">لا يوجد بيانات حضور</p>
        <p className="text-sm">لم يتم تسجيل أي حضور بعد</p>
      </div>
    )
  }
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
                title="إدارة الخدمات"
                description="نظرة عامة على الخدمات التي تديرها"
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
                title="الفصول"
                description="تقارير تفصيلية للفصول اللي بتخدم فيها"
              />
              <div className="flex flex-col gap-3">
                {(() => {
                  const leaderEntries = Object.entries(
                    access.leaderClasses.reduce<Record<string, ClassInfo[]>>(
                      (acc, cls) => {
                        (acc[cls.school_name] ??= []).push(cls);
                        return acc;
                      },
                      {}
                    )
                  );
                  return leaderEntries.map(([schoolName, classes]) => (
                    <SchoolGroup
                      key={schoolName}
                      schoolName={schoolName}
                      classes={classes}
                      summaryMap={summaryMap}
                      isLeader
                      defaultExpanded={leaderEntries.length === 1}
                    />
                  ));
                })()}
              </div>
            </section>
          )}

          {/* Teacher Classes Section (hidden for managers/admins — redundant) */}
          {access.teacherClasses.length > 0 && !access.isManager && (
            <section>
              <SectionHeader
                icon={GraduationCap}
                title="الفصول"
                description="تقارير حضور المخدومين في فصولك"
              />
              <div className="flex flex-col gap-3">
                {(() => {
                  const teacherEntries = Object.entries(
                    access.teacherClasses.reduce<Record<string, ClassInfo[]>>(
                      (acc, cls) => {
                        (acc[cls.school_name] ??= []).push(cls);
                        return acc;
                      },
                      {}
                    )
                  );
                  return teacherEntries.map(([schoolName, classes]) => (
                    <SchoolGroup
                      key={schoolName}
                      schoolName={schoolName}
                      classes={classes}
                      summaryMap={summaryMap}
                      isLeader={false}
                      defaultExpanded={teacherEntries.length === 1}
                    />
                  ));
                })()}
              </div>
            </section>
          )}
        </>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Helpers, Hooks & Selectors
// ---------------------------------------------------------------------------

const personTypeLabels: Record<string, string> = {
  student: "المخدومين",
  teacher: "الخدام",
};

function personTypeLabel(type: string) {
  return personTypeLabels[type] ?? type;
}

function useEventNameFilter(events: { event_name: string }[]) {
  const [selectedEventName, setSelectedEventName] = useState<string>("");

  const availableEventNames = useMemo(() => {
    const names = new Set<string>();
    for (const ev of events) names.add(ev.event_name);
    return Array.from(names);
  }, [events]);

  // Serialize to detect actual changes in the list of names
  const namesKey = availableEventNames.join("\0");

  useEffect(() => {
    if (availableEventNames.length > 0) {
      setSelectedEventName(availableEventNames[0]);
    } else {
      setSelectedEventName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  return { availableEventNames, selectedEventName, setSelectedEventName };
}

function EventNameSelector({
  availableEventNames,
  selectedEventName,
  onValueChange,
}: {
  availableEventNames: string[];
  selectedEventName: string;
  onValueChange: (name: string) => void;
}) {
  if (availableEventNames.length === 0) return null;
  return (
    <div className="pt-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <Select value={selectedEventName} onValueChange={onValueChange}>
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue placeholder="اختر الحدث" />
        </SelectTrigger>
        <SelectContent>
          {availableEventNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function usePersonTypeFilter(breakdowns: { person_type: string }[]) {
  const [selectedPersonType, setSelectedPersonType] = useState<string>("");

  const availablePersonTypes = useMemo(() => {
    const types = new Set<string>();
    for (const b of breakdowns) types.add(b.person_type);
    return Array.from(types);
  }, [breakdowns]);

  const typesKey = availablePersonTypes.join("\0");

  useEffect(() => {
    if (availablePersonTypes.length > 0) {
      setSelectedPersonType(availablePersonTypes[0]);
    } else {
      setSelectedPersonType("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesKey]);

  return { availablePersonTypes, selectedPersonType, setSelectedPersonType };
}

function PersonTypeSelector({
  availablePersonTypes,
  selectedPersonType,
  onValueChange,
}: {
  availablePersonTypes: string[];
  selectedPersonType: string;
  onValueChange: (type: string) => void;
}) {
  if (availablePersonTypes.length === 0) return null;
  return (
    <div className="pt-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <Select value={selectedPersonType} onValueChange={onValueChange}>
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue placeholder="اختر النوع" />
        </SelectTrigger>
        <SelectContent>
          {availablePersonTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {personTypeLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  const [showAll, setShowAll] = useState(false);
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

  const allEvents = useMemo(
    () => comparison?.classes.flatMap((c) => c.events) ?? [],
    [comparison]
  );

  const { availableEventNames, selectedEventName, setSelectedEventName } =
    useEventNameFilter(allEvents);

  // Collect all breakdowns from filtered events for person type filter
  const allBreakdowns = useMemo(
    () =>
      (comparison?.classes ?? [])
        .flatMap((c) => c.events)
        .filter((ev) => ev.event_name === selectedEventName)
        .flatMap((ev) => ev.breakdown),
    [comparison, selectedEventName]
  );

  const { availablePersonTypes, selectedPersonType, setSelectedPersonType } =
    usePersonTypeFilter(allBreakdowns);

  // Filter classes/events based on selected event name
  const filteredClasses = useMemo(() => {
    if (!comparison || !selectedEventName) return [];
    return comparison.classes
      .map((cls) => ({
        ...cls,
        events: cls.events.filter((ev) => ev.event_name === selectedEventName),
      }))
      .filter((cls) => cls.events.length > 0);
  }, [comparison, selectedEventName]);

  const totalPersons = filteredClasses.reduce((sum, cls) => {
    return (
      sum +
      cls.events.reduce((eSum, ev) => {
        const bd = ev.breakdown.find(
          (b) => b.person_type === selectedPersonType
        );
        return eSum + (bd?.total ?? 0);
      }, 0)
    );
  }, 0);

  const attendedPersons = filteredClasses.reduce((sum, cls) => {
    return (
      sum +
      cls.events.reduce((eSum, ev) => {
        const bd = ev.breakdown.find(
          (b) => b.person_type === selectedPersonType
        );
        return eSum + (bd?.attended ?? 0);
      }, 0)
    );
  }, 0);

  const overallRate =
    totalPersons > 0
      ? Math.round((attendedPersons / totalPersons) * 100)
      : 0;

  const sortedClasses = useMemo(
    () =>
      [...filteredClasses]
        .map((cls) => {
          const clsTotal = cls.events.reduce((s, e) => {
            const bd = e.breakdown.find(
              (b) => b.person_type === selectedPersonType
            );
            return s + (bd?.total ?? 0);
          }, 0);
          const clsAttended = cls.events.reduce((s, e) => {
            const bd = e.breakdown.find(
              (b) => b.person_type === selectedPersonType
            );
            return s + (bd?.attended ?? 0);
          }, 0);
          const rate =
            clsTotal > 0
              ? Math.round((clsAttended / clsTotal) * 100)
              : 0;
          return { ...cls, rate };
        })
        .sort((a, b) => b.rate - a.rate),
    [filteredClasses, selectedPersonType]
  );

  const visibleClasses = showAll ? sortedClasses : sortedClasses.slice(0, 4);
  const hasMore = sortedClasses.length > 4;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <School className="size-5 text-primary" />
            <CardTitle className="text-base">{school.school_name}</CardTitle>
          </div>
        </div>
        {!loading && (
          <>
            <EventNameSelector
              availableEventNames={availableEventNames}
              selectedEventName={selectedEventName}
              onValueChange={setSelectedEventName}
            />
            <PersonTypeSelector
              availablePersonTypes={availablePersonTypes}
              selectedPersonType={selectedPersonType}
              onValueChange={setSelectedPersonType}
            />
          </>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : comparison && filteredClasses.length > 0 ? (
          <div className="flex flex-col gap-3">
            {/* Overall quick stat */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <span className="text-sm text-muted-foreground">
                حضور {personTypeLabel(selectedPersonType)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  {attendedPersons}/{totalPersons}
                </span>
                <RateBadge rate={overallRate} />
              </div>
            </div>

            {/* Per-class list (sorted by attendance rate) */}
            <div className="flex flex-col gap-1.5">
              {visibleClasses.map((cls) => (
                <Link
                  key={cls.class_id}
                  to={`/reports/class/${cls.class_id}`}
                  className="flex items-center justify-between text-sm hover:bg-accent rounded px-2 py-1.5 transition-colors"
                >
                  <span className="truncate">{cls.class_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <MiniBar rate={cls.rate} />
                    <span className="text-xs text-muted-foreground w-8 text-left">
                      {cls.rate}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {hasMore && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors text-center cursor-pointer"
              >
                {showAll
                  ? "عرض أقل"
                  : `+ ${sortedClasses.length - 4} فصول أخرى`}
              </button>
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
  const allEvents = useMemo(() => summary?.events ?? [], [summary]);

  const { availableEventNames, selectedEventName, setSelectedEventName } =
    useEventNameFilter(allEvents);

  const filteredEvents = useMemo(() => {
    if (!selectedEventName) return [];
    return allEvents.filter((ev) => ev.event_name === selectedEventName);
  }, [allEvents, selectedEventName]);

  // Calculate total attendance from filtered events
  const studentBreakdowns = filteredEvents.flatMap((e) =>
    e.breakdown.filter((b) => b.person_type === "student")
  );

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
    isLeader
      ? filteredEvents.flatMap((e) =>
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
    <Card className="overflow-hidden hover:border-primary/30 transition-colors group">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{cls.class_name}</CardTitle>
            <CardDescription className="text-xs">
              {cls.school_name}
            </CardDescription>
          </div>
          <Link to={`/reports/class/${cls.class_id}`}>
            <ChevronLeft className="size-5 text-muted-foreground hover:text-primary transition-colors" />
          </Link>
        </div>
        <EventNameSelector
          availableEventNames={availableEventNames}
          selectedEventName={selectedEventName}
          onValueChange={setSelectedEventName}
        />
      </CardHeader>
      <CardContent>
        {summary && filteredEvents.length > 0 ? (
          <Link to={`/reports/class/${cls.class_id}`} className="flex flex-col gap-3">
            {/* Student stats */}
            {totalStudents > 0 && (
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
            )}

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


          </Link>
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
// School Group (collapsible)
// ---------------------------------------------------------------------------

function SchoolGroup({
  schoolName,
  classes,
  summaryMap,
  isLeader,
  defaultExpanded = false,
}: {
  schoolName: string;
  classes: ClassInfo[];
  summaryMap: Map<number, ClassSummaryData>;
  isLeader: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-right cursor-pointer py-1.5"
      >
        <ChevronLeft
          className={cn(
            "size-4 text-muted-foreground transition-transform shrink-0",
            expanded && "-rotate-90"
          )}
        />
        <School className="size-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-semibold text-muted-foreground truncate">
          {schoolName}
        </h3>
      </button>
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {classes.map((cls) => (
            <ClassReportCard
              key={`${isLeader ? "leader" : "teacher"}-${cls.class_id}`}
              cls={cls}
              summary={summaryMap.get(cls.class_id)}
              isLeader={isLeader}
            />
          ))}
        </div>
      )}
    </div>
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
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${dayName} \u200E${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}
