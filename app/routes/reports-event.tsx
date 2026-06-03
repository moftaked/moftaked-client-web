import { useState } from "react";
import { useNavigate } from "react-router";
import { useGoBack } from "~/hooks/use-go-back";
import api from "~/lib/api";
import type { Route } from "./+types/reports-event";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { BackButton } from "~/components/ui/back-button";
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
  TrendingUp,
  TrendingDown,
  Minus,
  GraduationCap,
  Users,
  Calendar,
  Target,
  ArrowUp,
  ArrowDown,
  Activity,
} from "lucide-react";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OccurrenceData {
  event_occurence_id: number;
  occurence_date: string;
  display_date: string;
  total: number;
  attended: number;
  absent: number;
  rate: number;
}

interface TrendsSummary {
  total_occurrences: number;
  average_rate: number;
  highest_rate: number;
  lowest_rate: number;
}

interface TrendsData {
  event_id: number;
  event_name: string;
  event_type: string;
  class_id: number;
  class_name: string;
  person_type: string;
  summary: TrendsSummary;
  occurrences: OccurrenceData[];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const classId = params.classId;
  const eventId = params.eventId;

  // Fetch student trends by default
  const studentRes = await api.get<{ success: boolean; data: TrendsData }>(
    `/reports/event/${eventId}/trends?type=student&limit=15`
  );

  // Try to fetch teacher trends (may fail if user is just a teacher)
  let teacherData: TrendsData | null = null;
  try {
    const teacherRes = await api.get<{ success: boolean; data: TrendsData }>(
      `/reports/event/${eventId}/trends?type=teacher&limit=15`
    );
    teacherData = teacherRes.data.data;
  } catch {
    // No access to teacher trends or no teachers
  }

  return {
    classId,
    eventId,
    studentData: studentRes.data.data,
    teacherData,
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
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ReportsEvent({ loaderData }: Route.ComponentProps) {
  const { classId, studentData, teacherData } = loaderData;
  const navigate = useNavigate();
  const goBack = useGoBack(`/reports/class/${classId}`);

  const eventType = studentData.event_type;

  const defaultPersonType = eventType === "teacher" ? "teacher" : "student";
  const [activePersonType, setActivePersonType] = useState<string>(defaultPersonType);
  const [limit, setLimit] = useState<string>("15");
  const [customStudentData, setCustomStudentData] = useState<TrendsData>(studentData);
  const [customTeacherData, setCustomTeacherData] = useState<TrendsData | null>(teacherData);
  const [loading, setLoading] = useState(false);

  const currentData =
    activePersonType === "teacher" && customTeacherData
      ? customTeacherData
      : customStudentData;

  async function handleLimitChange(newLimit: string) {
    setLimit(newLimit);
    setLoading(true);
    try {
      const [sRes, tRes] = await Promise.allSettled([
        api.get<{ success: boolean; data: TrendsData }>(
          `/reports/event/${loaderData.eventId}/trends?type=student&limit=${newLimit}`
        ),
        eventType !== "student"
          ? api.get<{ success: boolean; data: TrendsData }>(
              `/reports/event/${loaderData.eventId}/trends?type=teacher&limit=${newLimit}`
            )
          : Promise.reject(),
      ]);
      if (sRes.status === "fulfilled") {
        setCustomStudentData(sRes.value.data.data);
      }
      if (tRes.status === "fulfilled") {
        setCustomTeacherData(tRes.value.data.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BackButton onClick={goBack} />
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">
            {currentData.event_name}
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {currentData.class_name} — تحليل الحضور
          </p>
        </div>
      </div>

      {/* Person type tabs + limit selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {eventType === "all" && (
          <Tabs
            value={activePersonType}
            onValueChange={setActivePersonType}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="student" className="text-xs sm:text-sm gap-1.5">
                <GraduationCap className="size-4" />
                مخدومين
              </TabsTrigger>
              <TabsTrigger value="teacher" className="text-xs sm:text-sm gap-1.5">
                <Users className="size-4" />
                خدام
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <Select value={limit} onValueChange={handleLimitChange}>
          <SelectTrigger className="w-auto min-w-28">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">آخر 5</SelectItem>
            <SelectItem value="10">آخر 10</SelectItem>
            <SelectItem value="15">آخر 15</SelectItem>
            <SelectItem value="20">آخر 20</SelectItem>
            <SelectItem value="30">آخر 30</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-1">
          <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-full" />
          </div>
        </div>
      )}

      {currentData.occurrences.length === 0 ? (
        <EmptyState message="لا يوجد بيانات حضور لهذا الحدث بعد" />
      ) : (
        <>
          {/* Summary Stats */}
          <SummaryStats summary={currentData.summary} />

          {/* Bar Chart */}
          <AttendanceBarChart occurrences={currentData.occurrences} />

          {/* Occurrences Table */}
          <OccurrencesTable occurrences={currentData.occurrences} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Stats
// ---------------------------------------------------------------------------

function SummaryStats({ summary }: { summary: TrendsSummary }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        icon={Target}
        label="المتوسط"
        value={`${summary.average_rate}%`}
        color={rateColorText(summary.average_rate)}
      />
      <StatCard
        icon={ArrowUp}
        label="الأعلى"
        value={`${summary.highest_rate}%`}
        color="text-green-600 dark:text-green-400"
      />
      <StatCard
        icon={ArrowDown}
        label="الأقل"
        value={`${summary.lowest_rate}%`}
        color="text-red-600 dark:text-red-400"
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-1">
        <Icon className={cn("size-5", color)} />
        <span className={cn("text-xl sm:text-2xl font-bold", color)}>
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bar Chart (CSS-based)
// ---------------------------------------------------------------------------

function AttendanceBarChart({
  occurrences,
}: {
  occurrences: OccurrenceData[];
}) {
  const maxTotal = Math.max(...occurrences.map((o) => o.total), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">مخطط الحضور</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-0">
          {/* Y-axis labels + chart area */}
          <div className="relative">
            {/* Horizontal grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[100, 75, 50, 25, 0].map((pct) => (
                <div key={pct} className="flex items-center gap-1 w-full">
                  <span className="text-[10px] text-muted-foreground w-7 text-left shrink-0">
                    {pct}%
                  </span>
                  <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
                </div>
              ))}
            </div>

            {/* Bars container */}
            <div
              className="flex items-end gap-1 sm:gap-1.5 pr-9 pt-2"
              style={{ minHeight: "200px", height: "200px" }}
            >
              {occurrences.map((occ) => {
                const barHeight = occ.total > 0 ? (occ.rate / 100) * 100 : 0;

                return (
                  <div
                    key={occ.event_occurence_id}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-1 bg-popover text-popover-foreground border rounded-md px-2 py-1 text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      <div className="font-medium">{occ.display_date}</div>
                      <div>
                        {occ.attended}/{occ.total} ({occ.rate}%)
                      </div>
                    </div>

                    {/* The bar */}
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all duration-500 min-h-0.5",
                        rateColorBg(occ.rate),
                        "group-hover:opacity-80"
                      )}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex gap-1 sm:gap-1.5 pr-9 mt-1.5">
            {occurrences.map((occ, i) => (
              <div
                key={occ.event_occurence_id}
                className="flex-1 text-center text-[9px] sm:text-[10px] text-muted-foreground truncate"
              >
                {/* Only show every Nth label if there are many */}
                {occurrences.length <= 10 ||
                i % Math.ceil(occurrences.length / 10) === 0
                  ? occ.display_date
                  : ""}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Occurrences Table
// ---------------------------------------------------------------------------

function OccurrencesTable({
  occurrences,
}: {
  occurrences: OccurrenceData[];
}) {
  // Reverse to show most recent first
  const reversed = [...occurrences].reverse();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">تفاصيل المرات</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">الحاضرين</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">الغائبين</TableHead>
                <TableHead className="text-right">النسبة</TableHead>
                <TableHead className="text-right w-24">الرسم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reversed.map((occ) => (
                <TableRow key={occ.event_occurence_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3 text-muted-foreground" />
                      {occ.display_date}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {occ.attended}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {occ.total}
                  </TableCell>
                  <TableCell>
                    {occ.absent > 0 ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {occ.absent}
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RateBadge rate={occ.rate} />
                  </TableCell>
                  <TableCell>
                    <MiniBar rate={occ.rate} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between mt-3 px-2 text-sm text-muted-foreground">
          <span>إجمالي المرات: {occurrences.length}</span>
          <span>
            متوسط الحضور:{" "}
            {occurrences.length > 0
              ? Math.round(
                  occurrences.reduce((s, o) => s + o.rate, 0) /
                    occurrences.length
                )
              : 0}
            %
          </span>
        </div>
      </CardContent>
    </Card>
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

function MiniBar({ rate }: { rate: number }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          rateColorBg(rate)
        )}
        style={{ width: `${rate}%` }}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <BarChart3 className="size-12 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function rateColorBg(rate: number): string {
  if (rate >= 75) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function rateColorText(rate: number): string {
  if (rate >= 75) return "text-green-600 dark:text-green-400";
  if (rate >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}