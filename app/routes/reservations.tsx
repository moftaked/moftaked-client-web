import { useState, useEffect } from "react";
import type { Route } from "./+types/reservations";
import api from "~/lib/api";
import { forceFetchAndCache, resetTimestampCache } from "~/lib/sync-manager";
import { RESERVATIONS_KEY, removeCached } from "~/lib/offline-db";
import { getAccountId } from "~/lib/utils";
import { useNavigate, useRevalidator } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Plus, Loader2, Calendar, User, Users, Search } from "lucide-react";
import { toast } from "sonner";

interface Reservation {
  reservation_id: number;
  class_id: number;
  class_name: string;
  receiver_person_id: number;
  pickup_datetime: string;
  return_datetime: string;
  state: string;
  notes: string | null;
  created_by: number;
  creator_name: string;
  receiver_name: string;
  created_at: string;
}

interface ClassInfo {
  class_id: number;
  class_name: string;
}

const STATE_LABELS: Record<string, string> = {
  draft: "مسودة",
  waiting_for_approval: "بانتظار المراجعة",
  reserved: "مؤكد",
  waiting_for_pickup: "بانتظار الاستلام",
  picked_up: "تم الاستلام",
  waiting_for_return: "بانتظار الإرجاع",
  returned: "تم الإرجاع",
  completed: "مكتمل",
};

const STATE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  waiting_for_approval: "secondary",
  reserved: "default",
  waiting_for_pickup: "default",
  picked_up: "secondary",
  waiting_for_return: "destructive",
  returned: "outline",
  completed: "outline",
};

export async function clientLoader() {
  const reservations = await forceFetchAndCache<Reservation[]>(
    RESERVATIONS_KEY,
    () => api.get("/reservations").then(r => r.data.data),
  ).catch(() => [] as Reservation[]);
  return { reservations };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export default function Reservations({ loaderData }: Route.ComponentProps) {
  const { reservations } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const accountId = getAccountId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">الحجوزات</h1>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          حجز جديد
        </Button>
      </div>

      <Tabs value={roleFilter} onValueChange={setRoleFilter}>
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="created">المنشأة</TabsTrigger>
          <TabsTrigger value="receiving">المستلمة</TabsTrigger>
          <TabsTrigger value="reviewer">المراجعة</TabsTrigger>
          <TabsTrigger value="organizer">الإدارة</TabsTrigger>
        </TabsList>
      </Tabs>

      {reservations.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Calendar className="size-12 text-muted-foreground" />
          <p className="text-muted-foreground">لا توجد حجوزات</p>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            إنشاء حجز جديد
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reservations
            .filter(r => {
              if (roleFilter === "all") return true;
              if (roleFilter === "created") return accountId !== null && r.created_by === accountId;
              if (roleFilter === "receiving") return true;
              return true;
            })
            .map(r => (
              <ReservationCard key={r.reservation_id} reservation={r} onClick={() => navigate(`/reservations/${r.reservation_id}`)} />
            ))}
        </div>
      )}

      <CreateReservationSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          resetTimestampCache();
          removeCached(RESERVATIONS_KEY);
          revalidator.revalidate();
        }}
      />
    </div>
  );
}

function ReservationCard({ reservation, onClick }: { reservation: Reservation; onClick: () => void }) {
  const pickup = new Date(reservation.pickup_datetime);
  const ret = new Date(reservation.return_datetime);

  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{reservation.class_name}</span>
          <Badge variant={STATE_VARIANTS[reservation.state] ?? "outline"}>
            {STATE_LABELS[reservation.state] ?? reservation.state}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {pickup.toLocaleDateString("ar-SA")} - {ret.toLocaleDateString("ar-SA")}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="size-3" />
            {reservation.creator_name}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {reservation.receiver_name}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateReservationSheet({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [receiverId, setReceiverId] = useState<string>("");
  const [receiverSearch, setReceiverSearch] = useState("");
  const [teachers, setTeachers] = useState<{ teacher_id: number; teacher_name: string }[]>([]);
  const [pickupDatetime, setPickupDatetime] = useState("");
  const [returnDatetime, setReturnDatetime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClassId("");
    setReceiverId("");
    setReceiverSearch("");
    setTeachers([]);
    setPickupDatetime("");
    setReturnDatetime("");
    setNotes("");
    api.get<{ school_id: number; school_name: string; classes: ClassInfo[] }[]>("/classes")
      .then(r => setClasses(r.data.flatMap(s => s.classes)))
      .catch(() => toast.error("فشل تحميل الفصول"));
  }, [open]);

  const selectedClassId = classId ? parseInt(classId, 10) : null;
  useEffect(() => {
    if (!selectedClassId) { setTeachers([]); return; }
    api.get<{ success: boolean; data: { teacher_id: number; teacher_name: string }[] }>(`/classes/${selectedClassId}/teachers`)
      .then(r => setTeachers(r.data.data))
      .catch(() => toast.error("فشل تحميل الخدام"));
  }, [selectedClassId]);

  const filteredTeachers = receiverSearch.trim()
    ? teachers.filter(t => t.teacher_name.includes(receiverSearch.trim()))
    : teachers;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId || !receiverId || !pickupDatetime || !returnDatetime) return;
    if (new Date(returnDatetime) <= new Date(pickupDatetime)) {
      toast.error("وقت الإرجاع يجب أن يكون بعد وقت الاستلام");
      return;
    }
    setLoading(true);
    try {
      await api.post("/reservations", {
        class_id: parseInt(classId, 10),
        receiver_person_id: parseInt(receiverId, 10),
        pickup_datetime: pickupDatetime,
        return_datetime: returnDatetime,
        notes: notes.trim() || null,
      });
      toast.success("تم إنشاء الحجز");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("فشل إنشاء الحجز");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>حجز جديد</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
          <label className="text-sm font-medium text-muted-foreground">
            الخدمة
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="اختر الخدمة" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.class_id} value={String(c.class_id)}>{c.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="text-sm font-medium text-muted-foreground">
            المستلم
            <div className="flex items-center gap-2 mt-1">
              <div className="relative flex-1">
                <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="ابحث باسم الخادم..."
                  value={receiverSearch}
                  onChange={(e) => { setReceiverSearch(e.target.value); setReceiverId(""); }}
                  className="pr-9"
                />
              </div>
            </div>
            {receiverSearch.trim() && filteredTeachers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
                {filteredTeachers.slice(0, 20).map(t => (
                  <button
                    key={t.teacher_id}
                    type="button"
                    onClick={() => { setReceiverId(String(t.teacher_id)); setReceiverSearch(t.teacher_name); }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      receiverId === String(t.teacher_id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    {t.teacher_name}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="text-sm font-medium text-muted-foreground">
            وقت الاستلام
            <Input
              type="datetime-local"
              value={pickupDatetime}
              onChange={(e) => setPickupDatetime(e.target.value)}
              className="mt-1"
              required
            />
          </label>

          <label className="text-sm font-medium text-muted-foreground">
            وقت الإرجاع
            <Input
              type="datetime-local"
              value={returnDatetime}
              onChange={(e) => setReturnDatetime(e.target.value)}
              className="mt-1"
              required
            />
          </label>

          <label className="text-sm font-medium text-muted-foreground">
            ملاحظات
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm mt-1"
            />
          </label>

          <Button type="submit" disabled={loading || !classId || !receiverId || !pickupDatetime || !returnDatetime}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            إنشاء الحجز
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
