import { useNavigate } from "react-router";
import { useGoBack } from "~/hooks/use-go-back";
import api from "~/lib/api";
import type { Route } from "./+types/reports-person";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { BackButton } from "~/components/ui/back-button";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
  ArrowRight,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  GraduationCap,
  Users,
  User,
  Calendar,
  CheckCircle2,
  XCircle,
  BookOpen,
} from "lucide-react";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentOccurrence {
  occurence_date: string;
  display_date: string;
  attended: boolean;
}

interface EventHistory {
  event_id: number;
  event_name: string;
  class_id: number;
  class_name: string;
  total_occurrences: number;
  attended_count: number;
  rate: number;
  recent: RecentOccurrence[];
}

interface OverallStats {
  total_occurrences: number;
  attended: number;
  absent: number;
  rate: number;
}

interface PersonHistoryData {
  person_id: number;
  person_name: string;
  person_type: string;
  overall: OverallStats;
  events: EventHistory[];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const personId = params.personId;
  const type = params.type;

  const res = await api.get<{ success: boolean; data: PersonHistoryData }>(
    `/reports/person/${personId}/history?type=${type}&limit=20`
  );

  return {
    personId,
    type,
    data: res.data.data,
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
      <Skeleton className="h-32 rounded-xl" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ReportsPerson({ loaderData }: Route.ComponentProps) {
  const { type, data } = loaderData;
  const navigate = useNavigate();
  const fallbackPath = data.events.length > 0 ? `/reports/class/${data.events[0].class_id}` : "/reports";
  const goBack = useGoBack(fallbackPath);

  const typeLabel = type === "student" ? "مخدوم" : "خادم";
  const TypeIcon = type === "student" ? GraduationCap : Users;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BackButton onClick={goBack} />
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate flex items-center gap-2">
            <User className="size-5 text-primary shrink-0" />
            {data.person_name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs gap-1">
              <TypeIcon className="size-3" />
              {typeLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Overall Stats Card */}
      <OverallStatsCard overall={data.overall} />

      {/* Per-Event Histories */}
      {data.events.length === 0 ? (
        <EmptyState message="لا يوجد بيانات حضور لهذا الشخص بعد" />
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" />
            الحضور حسب الحدث
          </h2>
          {data.events.map((event) => (
            <EventHistoryCard
              key={`${event.event_id}-${event.class_id}`}
              event={event}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overall Stats Card
// ---------------------------------------------------------------------------

function OverallStatsCard({ overall }: { overall: OverallStats }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          {/* Main rate display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "size-14 sm:size-16 rounded-full flex items-center justify-center border-4",
                  rateRingColor(overall.rate)
                )}
              >
                <span
                  className={cn(
                    "text-lg sm:text-xl font-bold",
                    rateTextColor(overall.rate)
                  )}
                >
                  {overall.rate}%
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نسبة الحضور الكلية</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  من {overall.total_occurrences} مرة
                </p>
              </div>
            </div>
            <RateBadgeLarge rate={overall.rate} />
          </div>

          {/* Attended / Absent breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              <CheckCircle2 className="size-4 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {overall.attended}
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70">
                  حاضر
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              <XCircle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {overall.absent}
                </p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70">
                  غائب
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                rateBarColor(overall.rate)
              )}
              style={{ width: `${overall.rate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Event History Card
// ---------------------------------------------------------------------------

function EventHistoryCard({ event }: { event: EventHistory }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">
              {event.event_name}
            </CardTitle>
            <CardDescription className="text-xs">
              {event.class_name}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium">
              {event.attended_count}/{event.total_occurrences}
            </span>
            <RateBadge rate={event.rate} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                rateBarColor(event.rate)
              )}
              style={{ width: `${event.rate}%` }}
            />
          </div>

          {/* Dot timeline */}
          {event.recent.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <Calendar className="size-3" />
                آخر {event.recent.length} مرة
                <span className="text-muted-foreground/50 mx-1">|</span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-green-500 inline-block" />
                  حاضر
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-red-500 inline-block" />
                  غائب
                </span>
              </p>

              <div className="flex items-center gap-0.5 flex-wrap">
                {event.recent.map((occ, idx) => (
                  <div
                    key={`${occ.occurence_date}-${idx}`}
                    className="group relative"
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border rounded-md px-2 py-1 text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      <div>{occ.display_date}</div>
                      <div>{occ.attended ? "✓ حاضر" : "✗ غائب"}</div>
                    </div>

                    {/* Dot */}
                    <div
                      className={cn(
                        "size-5 sm:size-6 rounded-sm flex items-center justify-center text-[10px] font-medium transition-all cursor-default",
                        occ.attended
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
                        "group-hover:ring-2 group-hover:ring-primary/30"
                      )}
                    >
                      {occ.attended ? "✓" : "✗"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Streak info */}
          <StreakInfo recent={event.recent} />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Streak Info
// ---------------------------------------------------------------------------

function StreakInfo({ recent }: { recent: RecentOccurrence[] }) {
  if (recent.length === 0) return null;

  // Calculate current streak from the end
  const reversed = [...recent].reverse();
  let currentStreak = 0;
  let streakType: "attended" | "absent" | null = null;

  for (const occ of reversed) {
    if (streakType === null) {
      streakType = occ.attended ? "attended" : "absent";
      currentStreak = 1;
    } else if (
      (streakType === "attended" && occ.attended) ||
      (streakType === "absent" && !occ.attended)
    ) {
      currentStreak++;
    } else {
      break;
    }
  }

  if (currentStreak <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md",
        streakType === "attended"
          ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
      )}
    >
      {streakType === "attended" ? (
        <>
          <TrendingUp className="size-3.5" />
          <span>سلسلة حضور: {currentStreak} مرات متتالية ✨</span>
        </>
      ) : (
        <>
          <TrendingDown className="size-3.5" />
          <span>سلسلة غياب: {currentStreak} مرات متتالية ⚠️</span>
        </>
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

function RateBadgeLarge({ rate }: { rate: number }) {
  let color: string;
  let label: string;
  let Icon: React.ElementType;

  if (rate >= 85) {
    color =
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    label = "ممتاز";
    Icon = TrendingUp;
  } else if (rate >= 70) {
    color =
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    label = "جيد جداً";
    Icon = TrendingUp;
  } else if (rate >= 50) {
    color =
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    label = "مقبول";
    Icon = Minus;
  } else if (rate >= 25) {
    color =
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    label = "ضعيف";
    Icon = TrendingDown;
  } else {
    color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    label = "منقطع";
    Icon = TrendingDown;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
        color
      )}
    >
      <Icon className="size-4" />
      {label}
    </span>
  );
}

function rateBarColor(rate: number): string {
  if (rate >= 75) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function rateTextColor(rate: number): string {
  if (rate >= 75) return "text-green-600 dark:text-green-400";
  if (rate >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function rateRingColor(rate: number): string {
  if (rate >= 75)
    return "border-green-500/30 dark:border-green-400/30";
  if (rate >= 50)
    return "border-yellow-500/30 dark:border-yellow-400/30";
  return "border-red-500/30 dark:border-red-400/30";
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <BarChart3 className="size-12 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}