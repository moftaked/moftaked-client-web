import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/admin-events";
import { isManager } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "~/components/ui/sheet";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ArrowRight,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  CalendarDays,
  GraduationCap,
  Users,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClassInfo {
  class_id: number;
  class_name: string;
  school_id: number;
  school_name: string;
}

interface EventInfo {
  event_id: number;
  event_name: string;
  type: "student" | "teacher" | "all";
}

type SheetMode =
  | { type: "closed" }
  | { type: "create-event" }
  | { type: "edit-event"; event: EventInfo };

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader() {
  if (!isManager()) {
    throw new Response("Forbidden", { status: 403 });
  }

  const classesRes = await api.get<{ success: boolean; data: ClassInfo[] }>(
    "/classes/all",
  );

  return {
    classes: classesRes.data.data,
  };
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event type helpers
// ---------------------------------------------------------------------------

const EVENT_TYPE_LABELS: Record<string, string> = {
  student: "مخدومين",
  teacher: "خدام",
  all: "الكل",
};

function eventTypeBadgeVariant(
  type: string,
): "default" | "secondary" | "outline" {
  switch (type) {
    case "all":
      return "default";
    case "teacher":
      return "secondary";
    default:
      return "outline";
  }
}

function EventTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "student":
      return <GraduationCap className="size-4" />;
    case "teacher":
      return <Users className="size-4" />;
    default:
      return <UsersRound className="size-4" />;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminEvents({ loaderData }: Route.ComponentProps) {
  const { classes } = loaderData;

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>({ type: "closed" });
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);

  // Group classes by school for the picker
  const schoolMap = useMemo(() => {
    const map = new Map<string, ClassInfo[]>();
    for (const cls of classes) {
      const key = cls.school_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cls);
    }
    return map;
  }, [classes]);

  // Load events whenever selected class changes
  useEffect(() => {
    if (selectedClassId === null) {
      setEvents([]);
      return;
    }
    loadEvents(selectedClassId);
  }, [selectedClassId]);

  async function loadEvents(classId: number) {
    setLoadingEvents(true);
    try {
      const res = await api.get<{
        success: boolean;
        data: { studentEvents: EventInfo[]; teacherEvents: EventInfo[] };
      }>(`/events/classes/${classId}`);
      // Merge and deduplicate events (an event with type="all" appears in both lists)
      const all = [
        ...res.data.data.studentEvents,
        ...res.data.data.teacherEvents,
      ];
      const unique = Array.from(
        new Map(all.map((e) => [e.event_id, e])).values(),
      );
      unique.sort((a, b) => a.event_id - b.event_id);
      setEvents(unique);
    } catch {
      toast.error("حصلت مشكلة في تحميل الأحداث");
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function handleDeleteEvent(eventId: number) {
    if (selectedClassId === null) return;
    setDeletingEventId(eventId);
    try {
      await api.delete(`/events/${eventId}`, {
        data: { classId: selectedClassId },
      });
      toast.success("تم حذف الحدث");
      loadEvents(selectedClassId);
    } catch {
      toast.error("حصلت مشكلة في حذف الحدث");
    } finally {
      setDeletingEventId(null);
    }
  }

  const selectedClass = classes.find((c) => c.class_id === selectedClassId);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-4" />
        </Link>
        <h1 className="text-xl font-bold flex-1">إدارة الأحداث</h1>
      </div>

      {/* Class picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">اختر الفصل</label>
            <Select
              value={selectedClassId?.toString() ?? ""}
              onValueChange={(val) => setSelectedClassId(parseInt(val, 10))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر فصل لعرض أحداثه..." />
              </SelectTrigger>
              <SelectContent>
                {[...schoolMap.entries()].map(([schoolName, schoolClasses]) => (
                  <div key={schoolName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {schoolName}
                    </div>
                    {schoolClasses.map((cls) => (
                      <SelectItem
                        key={cls.class_id}
                        value={cls.class_id.toString()}
                      >
                        {cls.class_name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events list */}
      {selectedClassId !== null && (
        <>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex-1">
              {loadingEvents
                ? "جاري التحميل..."
                : `أحداث "${selectedClass?.class_name ?? ""}" (${events.length})`}
            </h2>
            <Button
              size="sm"
              onClick={() => setSheetMode({ type: "create-event" })}
              disabled={loadingEvents}
            >
              <Plus className="size-4" />
              حدث جديد
            </Button>
          </div>

          {loadingEvents ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              لا يوجد أحداث في هذا الفصل
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((event) => (
                <Card key={event.event_id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <CalendarDays className="size-5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <span className="font-semibold text-sm truncate">
                        {event.event_name}
                      </span>
                      <Badge
                        variant={eventTypeBadgeVariant(event.type)}
                        className="w-fit text-xs gap-1"
                      >
                        <EventTypeIcon type={event.type} />
                        {EVENT_TYPE_LABELS[event.type] ?? event.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        setSheetMode({ type: "edit-event", event })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            حذف حدث "{event.event_name}"؟
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتم حذف الحدث وجميع مرات الحضور المرتبطة به. هذا
                            الإجراء لا يمكن التراجع عنه.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() =>
                              handleDeleteEvent(event.event_id)
                            }
                            disabled={deletingEventId === event.event_id}
                          >
                            {deletingEventId === event.event_id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "حذف"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create / Edit Event Sheet */}
      <EventSheet
        mode={
          sheetMode.type === "create-event"
            ? "create"
            : sheetMode.type === "edit-event"
              ? "edit"
              : null
        }
        classId={selectedClassId}
        className={selectedClass?.class_name ?? ""}
        event={sheetMode.type === "edit-event" ? sheetMode.event : null}
        onClose={() => setSheetMode({ type: "closed" })}
        onSuccess={() => {
          setSheetMode({ type: "closed" });
          if (selectedClassId !== null) {
            loadEvents(selectedClassId);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Sheet (create / edit)
// ---------------------------------------------------------------------------

function EventSheet({
  mode,
  classId,
  className,
  event,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit" | null;
  classId: number | null;
  className: string;
  event: EventInfo | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const open = mode !== null;
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<"student" | "teacher" | "all">(
    "all",
  );
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(mode === "edit" && event ? event.event_name : "");
      setEventType(mode === "edit" && event ? event.type : "all");
      setSubmitting(false);
      setApiError(null);
    }
  }, [open, mode, event]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setApiError("اسم الحدث يجب أن يكون حرفين على الأقل");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      if (mode === "create" && classId !== null) {
        await api.post("/events", {
          classId,
          eventName: trimmed,
          type: eventType,
        });
        toast.success("تم إنشاء الحدث");
      } else if (mode === "edit" && event) {
        await api.put(`/classes/events/${event.event_id}`, {
          event_name: trimmed,
          type: eventType,
        });
        toast.success("تم تعديل الحدث");
      }
      onSuccess();
    } catch {
      setApiError("حصلت مشكلة، حاول تاني");
    } finally {
      setSubmitting(false);
    }
  }

  const contextLabel =
    mode === "create"
      ? `إضافة حدث في "${className}"`
      : mode === "edit" && event
        ? `تعديل حدث "${event.event_name}"`
        : "";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <CalendarDays className="size-5 inline-block ml-2" />
            {mode === "create" ? "إنشاء حدث جديد" : "تعديل الحدث"}
          </SheetTitle>
          <SheetDescription>{contextLabel}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">اسم الحدث</label>
            <Input
              placeholder="مثال: الخدمة"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">النوع</label>
            <Select
              value={eventType}
              onValueChange={(val) =>
                setEventType(val as "student" | "teacher" | "all")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <UsersRound className="size-4" />
                    الكل (مخدومين وخدام)
                  </div>
                </SelectItem>
                <SelectItem value="student">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="size-4" />
                    مخدومين فقط
                  </div>
                </SelectItem>
                <SelectItem value="teacher">
                  <div className="flex items-center gap-2">
                    <Users className="size-4" />
                    خدام فقط
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {apiError && (
            <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md text-sm text-center">
              {apiError}
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : mode === "create" ? (
              "إنشاء الحدث"
            ) : (
              "حفظ التعديل"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}