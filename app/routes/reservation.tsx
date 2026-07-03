import { useState, useEffect } from "react";
import type { Route } from "./+types/reservation";
import api from "~/lib/api";
import { resetTimestampCache } from "~/lib/sync-manager";
import { RESERVATIONS_KEY, reservationKey, removeCached } from "~/lib/offline-db";
import { useRevalidator } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { Pencil, Trash2, Loader2, Calendar, Clock, User, Users, Check, X, Plus, Paperclip, Send, Search, Ban, PackageOpen, Package, RotateCcw, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

interface ReservationDetail {
  reservation_id: number;
  class_id: number;
  class_name: string;
  receiver_account_id: number;
  pickup_datetime: string;
  return_datetime: string;
  state: ReservationState;
  notes: string | null;
  created_by: number;
  creator_real_name: string;
  receiver_real_name: string;
  items: ReservationItem[];
  reviewers: ReservationReviewer[];
  history: ReservationHistory[];
}

interface ReservationItem {
  reservation_equipment_id: number;
  equipment_id: number;
  quantity: number;
  equipment_name: string;
  description: string | null;
  photo: string | null;
  group_id: number;
  group_name: string;
  excluded_attachments: { attachment_id: number; attachment_name: string }[];
  all_attachments: { equipment_id: number; name: string; photo: string | null }[];
}

interface ReservationReviewer {
  reservation_reviewer_id: number;
  account_id: number;
  is_default: number;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  username: string;
  real_name: string;
}

interface ReservationHistory {
  reservation_history_id: number;
  account_id: number;
  action: string;
  details: string | null;
  created_at: string;
  username: string;
  real_name: string;
}

type ReservationState = 'draft' | 'waiting_for_approval' | 'reserved' | 'waiting_for_pickup' | 'picked_up' | 'waiting_for_return' | 'returned' | 'completed';

const STATE_LABELS: Record<ReservationState, string> = {
  draft: "مسودة",
  waiting_for_approval: "بانتظار المراجعة",
  reserved: "مؤكد",
  waiting_for_pickup: "بانتظار الاستلام",
  picked_up: "تم الاستلام",
  waiting_for_return: "بانتظار الإرجاع",
  returned: "تم الإرجاع",
  completed: "مكتمل",
};

const STATE_COLORS: Record<ReservationState, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  waiting_for_approval: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  reserved: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  waiting_for_pickup: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  picked_up: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  waiting_for_return: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  returned: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const reservationId = params.reservationId;
  const res = await api.get<{ success: boolean; data: ReservationDetail }>(
    `/reservations/${reservationId}`
  );
  let accessLevel: string | null = null;
  try {
    const groupsRes = await api.get<{ success: boolean; data: { group_id: number; access_level: string }[] }>("/equipment/groups");
    const groupIds = [...new Set(res.data.data.items.map(i => i.group_id))];
    const userGroups = groupsRes.data.data.filter(g => groupIds.includes(g.group_id));
    accessLevel = userGroups.some(g => g.access_level === "organizer") ? "organizer" : "member";
  } catch {}
  return { reservation: res.data.data, reservationId, accessLevel };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

export default function Reservation({ loaderData }: Route.ComponentProps) {
  const { reservation: initial, reservationId, accessLevel } = loaderData;
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(initial);
  const isOrganizer = accessLevel === "organizer";
  const isReviewer = reservation.reviewers.some(r => r.status === "pending");
  const [editOpen, setEditOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addReviewerOpen, setAddReviewerOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canEdit = ["draft", "waiting_for_approval", "reserved"].includes(reservation.state);
  const canDelete = ["draft", "waiting_for_approval"].includes(reservation.state);
  const canSubmit = reservation.state === "draft" || reservation.state === "waiting_for_approval";
  const canApprove = reservation.state === "waiting_for_approval";
  const isStateDraft = reservation.state === "draft";

  async function refresh() {
    resetTimestampCache();
    await removeCached(reservationKey(reservationId));
    await removeCached(RESERVATIONS_KEY);
    revalidator.revalidate();
  }

  async function handleAction(action: string, fn: () => Promise<void>) {
    setActionLoading(action);
    try {
      await fn();
      toast.success("تمت العملية بنجاح");
      await refresh();
    } catch {
      toast.error("فشلت العملية");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    await handleAction("delete", () => api.delete(`/reservations/${reservationId}`));
    navigate("/reservations");
  }

  async function handleSubmit() {
    await handleAction("submit", () => api.post(`/reservations/${reservationId}/submit`));
  }

  async function handleApprove() {
    await handleAction("approve", () =>
      api.post(`/reservations/${reservationId}/approve`, reviewNotes ? { notes: reviewNotes } : {})
    );
    setReviewNotes("");
  }

  async function handleReject() {
    await handleAction("reject", () =>
      api.post(`/reservations/${reservationId}/reject`, rejectNotes ? { notes: rejectNotes } : {})
    );
    setRejectNotes("");
  }

  async function handlePickUp() {
    await handleAction("pickup", () => api.post(`/reservations/${reservationId}/pick-up`));
  }

  async function handleReturn() {
    await handleAction("return", () => api.post(`/reservations/${reservationId}/return`));
  }

  async function handleComplete() {
    await handleAction("complete", () => api.post(`/reservations/${reservationId}/complete`));
  }

  async function handleReopen() {
    await handleAction("reopen", () => api.post(`/reservations/${reservationId}/reopen`));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{reservation.class_name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
            </Button>
          )}
          {(canDelete || isOrganizer) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                  <AlertDialogDescription>حذف هذا الحجز؟</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>لأ</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>أكيد</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* State badge */}
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium w-fit ${STATE_COLORS[reservation.state]}`}>
        {STATE_LABELS[reservation.state]}
      </div>

      {/* People */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">المنشئ:</span>
            <span>{reservation.creator_real_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">المستلم:</span>
            <span>{reservation.receiver_real_name}</span>
          </div>
        </CardContent>
      </Card>

      {/* Time range */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">الاستلام:</span>
            <span>{new Date(reservation.pickup_datetime).toLocaleString("ar-SA")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">الإرجاع:</span>
            <span>{new Date(reservation.return_datetime).toLocaleString("ar-SA")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {reservation.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">ملاحظات</p>
            <p className="text-sm mt-1">{reservation.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Equipment items */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">المعدات</h2>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setAddItemOpen(true)}>
                <Plus className="size-4" />
                إضافة معدة
              </Button>
            )}
          </div>
          {reservation.items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد معدات مضافة</p>
          ) : (
            <div className="flex flex-col gap-2">
              {reservation.items.map(item => (
                <ReservationItemRow
                  key={item.reservation_equipment_id}
                  item={item}
                  canEdit={canEdit}
                  onRemove={() => handleAction("remove", () =>
                    api.delete(`/reservations/${reservationId}/items/${item.reservation_equipment_id}`)
                  )}
                  onExcludeAttachment={(attachmentId) => handleAction("exclude", () =>
                    api.post(`/reservations/${reservationId}/items/${item.reservation_equipment_id}/exclude/${attachmentId}`)
                  )}
                  onIncludeAttachment={(attachmentId) => handleAction("include", () =>
                    api.delete(`/reservations/${reservationId}/items/${item.reservation_equipment_id}/exclude/${attachmentId}`)
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviewers */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">المراجعون</h2>
            </div>
            {isOrganizer && (
              <Button variant="outline" size="sm" onClick={() => setAddReviewerOpen(true)}>
                <Plus className="size-4" />
                إضافة مراجع
              </Button>
            )}
          </div>
          {reservation.reviewers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">لا يوجد مراجعون</p>
          ) : (
            <div className="flex flex-col gap-2">
              {reservation.reviewers.map(r => (
                <div key={r.reservation_reviewer_id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{r.real_name || r.username}</span>
                    {r.is_default === 1 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 h-5">افتراضي</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "pending" && <Badge variant="secondary">بانتظار</Badge>}
                    {r.status === "approved" && <Badge variant="default">موافق</Badge>}
                    {r.status === "rejected" && <Badge variant="destructive">رافض</Badge>}
                    {isOrganizer && r.is_default === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleAction("remove-reviewer", () =>
                          api.delete(`/reservations/${reservationId}/reviewers/${r.reservation_reviewer_id}`)
                        )}
                      >
                        <X className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {canSubmit && (
          <Button onClick={handleSubmit} disabled={actionLoading === "submit"}>
            {actionLoading === "submit" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            إرسال للمراجعة
          </Button>
        )}

        {canApprove && (
          <>
            <div className="flex flex-col gap-2 p-3 rounded-lg border">
              <Button onClick={handleApprove} disabled={actionLoading === "approve"} variant="default">
                {actionLoading === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                موافقة
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={actionLoading === "reject"}>
                    {actionLoading === "reject" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                    رفض
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>رفض الحجز</AlertDialogTitle>
                    <AlertDialogDescription>
                      <textarea
                        placeholder="سبب الرفض (اختياري)"
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm mt-2"
                      />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleReject}>تأكيد الرفض</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}

        {isOrganizer && reservation.state === "waiting_for_pickup" && (
          <Button onClick={handlePickUp} disabled={actionLoading === "pickup"}>
            {actionLoading === "pickup" ? <Loader2 className="size-4 animate-spin" /> : <PackageOpen className="size-4" />}
            تأكيد الاستلام
          </Button>
        )}

        {isOrganizer && reservation.state === "waiting_for_return" && (
          <Button onClick={handleReturn} disabled={actionLoading === "return"}>
            {actionLoading === "return" ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
            تأكيد الإرجاع
          </Button>
        )}

        {isOrganizer && reservation.state === "reserved" && (
          <Button onClick={handleComplete} disabled={actionLoading === "complete"}>
            {actionLoading === "complete" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            إنهاء الحجز
          </Button>
        )}

        {isOrganizer && reservation.state === "completed" && (
          <Button variant="outline" onClick={handleReopen} disabled={actionLoading === "reopen"}>
            {actionLoading === "reopen" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            إعادة فتح الحجز
          </Button>
        )}
      </div>

      {/* History */}
      {reservation.history.length > 0 && (
        <Card>
          <CardContent className="p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">سجل التغييرات</h2>
            <div className="flex flex-col gap-1.5">
              {reservation.history.map(h => (
                <div key={h.reservation_history_id} className="flex items-start gap-2 text-xs">
                  <RefreshCw className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{h.real_name || h.username}</span>
                    <span className="text-muted-foreground"> - {h.action}</span>
                    <span className="text-muted-foreground block">{new Date(h.created_at).toLocaleString("ar-SA")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <EditReservationSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        reservation={reservation}
        onSave={async (data) => {
          await handleAction("edit", () => api.put(`/reservations/${reservationId}`, data));
          setEditOpen(false);
        }}
      />

      <AddItemSheet
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        reservationId={reservationId}
        onAdd={async (equipmentId, quantity) => {
          await handleAction("add-item", () =>
            api.post(`/reservations/${reservationId}/items`, { equipment_id: equipmentId, quantity })
          );
          setAddItemOpen(false);
        }}
      />

      <AddReviewerSheet
        open={addReviewerOpen}
        onOpenChange={setAddReviewerOpen}
        reservationId={reservationId}
        onAdd={async (accountId) => {
          await handleAction("add-reviewer", () =>
            api.post(`/reservations/${reservationId}/reviewers`, { account_id: accountId })
          );
          setAddReviewerOpen(false);
        }}
      />
    </div>
  );
}

function ReservationItemRow({
  item,
  canEdit,
  onRemove,
  onExcludeAttachment,
  onIncludeAttachment,
}: {
  item: ReservationItem;
  canEdit: boolean;
  onRemove: () => void;
  onExcludeAttachment: (attachmentId: number) => void;
  onIncludeAttachment: (attachmentId: number) => void;
}) {
  const [showAttachments, setShowAttachments] = useState(false);
  const excludedIds = new Set(item.excluded_attachments.map(a => a.attachment_id));

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{item.equipment_name}</p>
          <p className="text-xs text-muted-foreground">{item.group_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {item.quantity > 1 && <Badge variant="secondary">{item.quantity}</Badge>}
          {canEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>إزالة المعدة</AlertDialogTitle>
                  <AlertDialogDescription>إزالة {item.equipment_name} من الحجز؟</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>لأ</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove}>أكيد</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      {item.all_attachments.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowAttachments(!showAttachments)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Paperclip className="size-3" />
            {item.all_attachments.length} ملحق
            {showAttachments ? " ▲" : " ▼"}
          </button>
          {showAttachments && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {item.all_attachments.map(att => {
                const excluded = excludedIds.has(att.equipment_id);
                return (
                  <button
                    key={att.equipment_id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => excluded ? onIncludeAttachment(att.equipment_id) : onExcludeAttachment(att.equipment_id)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      excluded
                        ? "border-destructive/30 text-destructive/60 line-through"
                        : "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                    } ${canEdit ? "hover:bg-accent cursor-pointer" : "cursor-default"}`}
                  >
                    {att.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditReservationSheet({
  open,
  onOpenChange,
  reservation,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reservation: ReservationDetail;
  onSave: (data: { pickup_datetime?: string; return_datetime?: string; notes?: string | null }) => Promise<void>;
}) {
  const [pickupDatetime, setPickupDatetime] = useState(reservation.pickup_datetime.slice(0, 16));
  const [returnDatetime, setReturnDatetime] = useState(reservation.return_datetime.slice(0, 16));
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        pickup_datetime: pickupDatetime !== reservation.pickup_datetime.slice(0, 16) ? pickupDatetime : undefined,
        return_datetime: returnDatetime !== reservation.return_datetime.slice(0, 16) ? returnDatetime : undefined,
        notes: notes !== (reservation.notes ?? "") ? (notes.trim() || null) : undefined,
      });
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8">
        <SheetHeader><SheetTitle>تعديل الحجز</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
          <label className="text-sm font-medium text-muted-foreground">
            وقت الاستلام
            <Input type="datetime-local" value={pickupDatetime} onChange={(e) => setPickupDatetime(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm font-medium text-muted-foreground">
            وقت الإرجاع
            <Input type="datetime-local" value={returnDatetime} onChange={(e) => setReturnDatetime(e.target.value)} className="mt-1" />
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
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} حفظ
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AddItemSheet({
  open,
  onOpenChange,
  reservationId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reservationId: string;
  onAdd: (equipmentId: number, quantity: number) => Promise<void>;
}) {
  const [items, setItems] = useState<{ equipment_id: number; name: string; group_name: string; quantity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addQty, setAddQty] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSearch("");
    setSelectedId(null);
    setAddQty("1");
    api.get("/equipment/groups")
      .then(r => {
        const groups = r.data.data as { group_id: number; group_name: string; access_level: string }[];
        return Promise.all(
          groups.map((g: any) =>
            api.get(`/equipment/groups/${g.group_id}/items`)
              .then(r => (r.data.data as any[]).map((i: any) => ({ ...i, group_name: g.group_name })))
          )
        );
      })
      .then(results => setItems(results.flat()))
      .catch(() => toast.error("فشل تحميل المعدات"))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = search.trim()
    ? items.filter(i => i.name.includes(search.trim()))
    : items;

  async function handleAdd() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await onAdd(selectedId, Math.max(1, parseInt(addQty, 10) || 1));
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>إضافة معدة</SheetTitle></SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <Input
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد نتائج</p>
            ) : (
              filtered.map(i => (
                <button
                  key={i.equipment_id}
                  type="button"
                  onClick={() => setSelectedId(i.equipment_id)}
                  className={`flex items-center justify-between rounded-lg border p-2.5 text-start hover:bg-accent/50 transition-colors ${
                    selectedId === i.equipment_id ? "border-primary bg-accent/30" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.group_name}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{i.quantity}</Badge>
                </button>
              ))
            )}
          </div>
          {selectedId && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="الكمية"
                className="w-24"
              />
              <Button onClick={handleAdd} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                إضافة
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddReviewerSheet({
  open,
  onOpenChange,
  reservationId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reservationId: string;
  onAdd: (accountId: number) => Promise<void>;
}) {
  const [accounts, setAccounts] = useState<{ account_id: number; username: string; real_name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    api.get<{ success: boolean; data: { account_id: number; username: string; real_name: string }[] }>("/accounts")
      .then(r => setAccounts(r.data.data))
      .catch(() => toast.error("فشل تحميل الحسابات"));
  }, [open]);

  const filtered = search.trim()
    ? accounts.filter(a => a.real_name.includes(search.trim()) || a.username.includes(search.trim()))
    : accounts;

  async function handleAdd(accountId: number) {
    setSaving(true);
    try {
      await onAdd(accountId);
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>إضافة مراجع</SheetTitle></SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <Input
            placeholder="ابحث باسم المستخدم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد نتائج</p>
            ) : (
              filtered.slice(0, 30).map(a => (
                <button
                  key={a.account_id}
                  type="button"
                  disabled={saving}
                  onClick={() => handleAdd(a.account_id)}
                  className="flex items-center justify-between rounded-lg border p-2.5 text-start hover:bg-accent/50 transition-colors"
                >
                  <span className="text-sm font-medium">{a.real_name || a.username}</span>
                  <span className="text-xs text-muted-foreground">{a.username}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
