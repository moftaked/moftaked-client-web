import { useState, useEffect, useMemo } from "react";
import type { Route } from "./+types/reservation";
import api from "~/lib/api";
import { resetTimestampCache } from "~/lib/sync-manager";
import { RESERVATIONS_KEY, reservationKey, removeCached } from "~/lib/offline-db";
import { getAccountId, getEquipmentPhotoUrl } from "~/lib/utils";
import { usePhotoBlobUrl } from "~/hooks/use-photo-blob-url";
import { useRevalidator } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { DatePicker } from "~/components/ui/date-picker";
import { Pencil, Trash2, Loader2, Calendar, Clock, User, Users, Check, X, Plus, Paperclip, Send, Search, Ban, PackageOpen, Package, RotateCcw, RefreshCw, Undo2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

interface ReservationDetail {
  reservation_id: number;
  class_id: number;
  class_name: string;
  group_id: number | null;
  receiver_person_id: number;
  pickup_datetime: string;
  return_datetime: string;
  state: ReservationState;
  notes: string | null;
  created_by: number;
  creator_real_name: string;
  receiver_real_name: string;
  items: ReservationItem[];
  reviewers: ReservationReviewer[];
  is_current_user_reviewer: boolean;
  history: ReservationHistory[];
  rejection_reason: string | null;
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
  blocked_attachment_ids: number[];
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

type ReservationState = 'draft' | 'waiting_for_approval' | 'reserved' | 'waiting_for_pickup' | 'picked_up' | 'waiting_for_return' | 'returned';

const STATE_LABELS: Record<ReservationState, string> = {
  draft: "مسودة",
  waiting_for_approval: "بانتظار المراجعة",
  reserved: "مؤكد",
  waiting_for_pickup: "بانتظار الاستلام",
  picked_up: "تم الاستلام",
  waiting_for_return: "بانتظار الإرجاع",
  returned: "تم الإرجاع",

};

const STATE_COLORS: Record<ReservationState, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  waiting_for_approval: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  reserved: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  waiting_for_pickup: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  picked_up: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  waiting_for_return: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  returned: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",

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
  useEffect(() => { setReservation(initial); }, [initial]);
  const isOrganizer = accessLevel === "organizer";
  const isReviewer = reservation.is_current_user_reviewer;
  const [editOpen, setEditOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addReviewerOpen, setAddReviewerOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canEdit = ["draft", "waiting_for_approval"].includes(reservation.state);
  const canDelete = ["draft", "waiting_for_approval"].includes(reservation.state);
  const canSubmit = reservation.state === "draft";
  const canUnsubmit = reservation.state === "waiting_for_approval" && (isOrganizer || reservation.created_by === getAccountId());
  const canApprove = reservation.state === "waiting_for_approval" && isReviewer;
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
    } catch (err) {
      const msg = (err as any)?.response?.data?.message || "فشلت العملية";
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/reservations/${reservationId}`);
      toast.success("تمت العملية بنجاح");
      resetTimestampCache();
      await removeCached(reservationKey(reservationId));
      await removeCached(RESERVATIONS_KEY);
      navigate(-1);
    } catch {
      toast.error("فشلت العملية");
    }
  }

  async function handleSubmit() {
    await handleAction("submit", () => api.post(`/reservations/${reservationId}/submit`));
  }

  async function handleUnsubmit() {
    await handleAction("unsubmit", () => api.post(`/reservations/${reservationId}/unsubmit`));
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

  async function handleMarkForPickup() {
    await handleAction("mark-for-pickup", () => api.post(`/reservations/${reservationId}/mark-for-pickup`));
  }

  async function handlePickUp() {
    await handleAction("pickup", () => api.post(`/reservations/${reservationId}/pick-up`));
  }

  async function handleMarkForReturn() {
    await handleAction("mark-for-return", () => api.post(`/reservations/${reservationId}/mark-for-return`));
  }

  async function handleReturn() {
    await handleAction("return", () => api.post(`/reservations/${reservationId}/return`));
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

      {/* Rejection reason — only when latest event is rejected */}
      {reservation.rejection_reason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
          <X className="size-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">سبب الرفض</p>
            <p className="text-sm text-muted-foreground mt-0.5">{reservation.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* People */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">اللي حجز:</span>
            <span>{reservation.creator_real_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">اللي هيستلم:</span>
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
            <span>{new Date(reservation.pickup_datetime).toLocaleString("en-GB", { day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(/\bam\b/gi, "ص").replace(/\bpm\b/gi, "م")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">الإرجاع:</span>
            {new Date(reservation.pickup_datetime).toLocaleDateString("en-GB") === new Date(reservation.return_datetime).toLocaleDateString("en-GB") ? (
              <span>نفس اليوم {new Date(reservation.return_datetime).toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\bam\b/gi, "ص").replace(/\bpm\b/gi, "م")}</span>
            ) : (
              <span>{new Date(reservation.return_datetime).toLocaleString("en-GB", { day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(/\bam\b/gi, "ص").replace(/\bpm\b/gi, "م")}</span>
            )}
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
              <h2 className="text-sm font-semibold text-muted-foreground">الادوات</h2>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setAddItemOpen(true)}>
                <Plus className="size-4" />
                إضافة ادوات
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
            {isOrganizer && canEdit && (
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
                      <Badge variant="outline" className="text-[10px] px-1.5 h-5">اساسي</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "pending" && <Badge variant="secondary">بانتظار الموافقة</Badge>}
                    {r.status === "approved" && <Badge variant="default">موافق</Badge>}
                    {r.status === "rejected" && <Badge variant="destructive">رافض</Badge>}
                    {isOrganizer && canEdit && r.is_default === 0 && (
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

        {canUnsubmit && (
          <Button onClick={handleUnsubmit} disabled={actionLoading === "unsubmit"} variant="outline">
            {actionLoading === "unsubmit" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            عودة للمسودة
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

        {isOrganizer && reservation.state === "picked_up" && (
          <Button onClick={handleMarkForReturn} disabled={actionLoading === "mark-for-return"}>
            {actionLoading === "mark-for-return" ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
            تجهيز للإرجاع
          </Button>
        )}

        {isOrganizer && reservation.state === "reserved" && (
          <>
            <Button variant="outline" onClick={handleReopen} disabled={actionLoading === "reopen"}>
              {actionLoading === "reopen" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              إعادة فتح الحجز
            </Button>
            <Button onClick={handleMarkForPickup} disabled={actionLoading === "mark-for-pickup"}>
              {actionLoading === "mark-for-pickup" ? <Loader2 className="size-4 animate-spin" /> : <PackageOpen className="size-4" />}
              تجهيز للاستلام
            </Button>
          </>
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
                    {h.details && (() => {
                      const d = typeof h.details === 'string' ? JSON.parse(h.details) : h.details;
                      return d.notes ? <p className="text-muted-foreground mt-0.5">{d.notes}</p> : null;
                    })()}
                    <span className="text-muted-foreground block">{new Date(h.created_at + 'Z').toLocaleString("en-GB", { day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(/\bam\b/gi, "ص").replace(/\bpm\b/gi, "م")}</span>
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
        groupId={reservation.group_id}
        excludeIds={new Set(reservation.items.flatMap(i => [i.equipment_id, ...i.all_attachments.map(a => a.equipment_id)]))}
        pickupDatetime={reservation.pickup_datetime}
        returnDatetime={reservation.return_datetime}
        onAdd={async (items) => {
          setActionLoading("add-item");
          try {
            for (const { equipmentId, quantity } of items) {
              await api.post(`/reservations/${reservationId}/items`, { equipment_id: equipmentId, quantity });
            }
            toast.success("تمت إضافة الادوات");
            await refresh();
          } catch {
            toast.error("فشلت إضافة بعض الادوات");
          } finally {
            setActionLoading(null);
            setAddItemOpen(false);
          }
        }}
      />

      <AddReviewerSheet
        open={addReviewerOpen}
        onOpenChange={setAddReviewerOpen}
        reservationId={reservationId}
        groupId={reservation.group_id ?? undefined}
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
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false);
  const excludedIds = new Set(item.excluded_attachments.map(a => a.attachment_id));
  const { blobUrl, loading } = usePhotoBlobUrl(item.photo, "md", getEquipmentPhotoUrl);

  return (
    <>
      {fullscreenPhoto && blobUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setFullscreenPhoto(false)}>
          <img src={blobUrl} alt="" className="max-h-[90dvh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {loading ? (
              <div className="size-10 shrink-0 rounded overflow-hidden bg-muted animate-pulse" />
            ) : blobUrl ? (
              <button type="button" onClick={() => setFullscreenPhoto(true)} className="size-10 shrink-0 rounded overflow-hidden">
                <img src={blobUrl} alt="" className="size-full object-cover cursor-pointer hover:opacity-80 transition-opacity" />
              </button>
            ) : null}
            <p className="text-sm font-medium">{item.equipment_name}</p>
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
                  <AlertDialogTitle>إزالة الادوات</AlertDialogTitle>
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
        <div className="flex flex-wrap gap-1 mt-2">
          {item.all_attachments.map(att => {
            const excluded = excludedIds.has(att.equipment_id);
            return (
              <div
                key={att.equipment_id}
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                  excluded
                    ? "border-destructive/30 text-destructive/60 line-through"
                    : "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                }`}
              >
                <span>{att.name}</span>
                {canEdit && !excluded && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onExcludeAttachment(att.equipment_id); }}
                    className="transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                )}
                {canEdit && excluded && !item.blocked_attachment_ids.includes(att.equipment_id) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onIncludeAttachment(att.equipment_id); }}
                    className="transition-colors hover:text-green-600"
                  >
                    <Plus className="size-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
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
  const initialPickup = reservation.pickup_datetime.replace(" ", "T").slice(0, 16);
  const initialReturn = reservation.return_datetime.replace(" ", "T").slice(0, 16);
  const [pickupDatetime, setPickupDatetime] = useState(initialPickup);
  const [returnDatetime, setReturnDatetime] = useState(initialReturn);
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        pickup_datetime: pickupDatetime !== initialPickup ? pickupDatetime : undefined,
        return_datetime: returnDatetime !== initialReturn ? returnDatetime : undefined,
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
            <DatePicker value={pickupDatetime} onChange={setPickupDatetime} showTime />
          </label>
          <label className="text-sm font-medium text-muted-foreground">
            وقت الإرجاع
            <DatePicker value={returnDatetime} onChange={setReturnDatetime} showTime />
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

function SelectedEquipRow2({ item, attachments, onQuantityChange, onRemove }: { item: { equipment_id: number; name: string; photo?: string | null; quantity: number; maxQuantity: number }; attachments: { equipment_id: number; name: string }[]; onQuantityChange: (id: number, qty: number) => void; onRemove: (id: number) => void }) {
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false);
  const { blobUrl, loading } = usePhotoBlobUrl(item.photo, "md", getEquipmentPhotoUrl);
  return (
    <>
      {fullscreenPhoto && blobUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setFullscreenPhoto(false)}>
          <img src={blobUrl} alt="" className="max-h-[90dvh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <div className="rounded-lg border p-2">
        <div className="flex items-center gap-2">
          <div className="size-7 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
            {loading ? <div className="size-full animate-pulse bg-muted" /> : blobUrl ? <img src={blobUrl} alt="" className="size-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFullscreenPhoto(true); }} /> : <ImageIcon className="size-3.5 text-muted-foreground" />}
          </div>
          <span className="text-sm flex-1 truncate">{item.name}</span>
      {item.maxQuantity > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onQuantityChange(item.equipment_id, item.quantity + 1)}
            disabled={item.quantity >= item.maxQuantity}
            className="size-7 rounded border flex items-center justify-center text-sm hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            +
          </button>
          <span className="w-8 text-center text-xs tabular-nums">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(item.equipment_id, item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="size-7 rounded border flex items-center justify-center text-sm hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            -
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onRemove(item.equipment_id)}
        className="text-destructive hover:text-destructive/80"
      >
        <Trash2 className="size-3.5" />
      </button>
      </div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {attachments.map(a => (
            <span key={a.equipment_id} className="text-[10px] px-1.5 py-0.5 rounded-full border border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
              {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

function EquipSelectBtn({ item, onClick, disabled }: { item: { equipment_id: number; name: string; photo?: string | null; quantity: number; available_quantity?: number }; onClick: () => void; disabled: boolean }) {
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false);
  const { blobUrl, loading } = usePhotoBlobUrl(item.photo, "md", getEquipmentPhotoUrl);
  return (
    <>
      {fullscreenPhoto && blobUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setFullscreenPhoto(false)}>
          <img src={blobUrl} alt="" className="max-h-[90dvh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center gap-2 rounded-lg border p-2.5 text-start hover:bg-accent/50 transition-colors ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        <div className="size-7 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
          {loading ? <div className="size-full animate-pulse bg-muted" /> : blobUrl ? <img src={blobUrl} alt="" className="size-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); setFullscreenPhoto(true); }} /> : <ImageIcon className="size-3.5 text-muted-foreground" />}
        </div>
        <span className="text-sm font-medium flex-1 truncate">{item.name}</span>
      {item.available_quantity !== undefined
        ? item.available_quantity < item.quantity && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {item.available_quantity}/{item.quantity}
            </Badge>
          )
        : item.quantity > 1 && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {item.quantity}
            </Badge>
          )}
    </button>
    </>
  );
}

function AddItemSheet({
  open,
  onOpenChange,
  groupId,
  excludeIds,
  pickupDatetime,
  returnDatetime,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: number | null;
  excludeIds: Set<number>;
  pickupDatetime: string;
  returnDatetime: string;
  onAdd: (items: { equipmentId: number; quantity: number }[]) => Promise<void>;
}) {
  const [items, setItems] = useState<{ equipment_id: number; name: string; quantity: number; available_quantity?: number; photo?: string | null; parent_equipment_id?: number | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedEquip, setSelectedEquip] = useState<{ equipment_id: number; name: string; quantity: number; maxQuantity: number; photo?: string | null }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !groupId) return;
    setLoading(true);
    setSearch("");
    setSelectedEquip([]);
    api.get(`/equipment/groups/${groupId}/items`, {
      params: { pickup_datetime: pickupDatetime, return_datetime: returnDatetime },
    })
      .then(r => setItems(r.data.data.map((i: any) => ({ equipment_id: i.equipment_id, name: i.name, quantity: i.quantity, available_quantity: i.available_quantity, photo: i.photo, parent_equipment_id: i.parent_equipment_id }))))
      .catch(() => toast.error("فشل تحميل الادوات"))
      .finally(() => setLoading(false));
  }, [open, groupId, pickupDatetime, returnDatetime]);

  const childrenMap = useMemo(() => {
    const map = new Map<number, { equipment_id: number; name: string }[]>();
    for (const i of items) {
      if (i.parent_equipment_id) {
        const list = map.get(i.parent_equipment_id) ?? [];
        list.push({ equipment_id: i.equipment_id, name: i.name });
        map.set(i.parent_equipment_id, list);
      }
    }
    return map;
  }, [items]);

  const filtered = items
    .filter(i => {
      const available = i.available_quantity ?? i.quantity;
      return available > 0;
    })
    .filter(i => !excludeIds.has(i.equipment_id))
    .filter(i => !search.trim() || i.name.includes(search.trim()));

  function handleAddEquipment(item: { equipment_id: number; name: string; quantity: number; available_quantity?: number; photo?: string | null; parent_equipment_id?: number | null }) {
    setSelectedEquip((prev) => {
      if (prev.some(e => e.equipment_id === item.equipment_id)) return prev;
      if (item.parent_equipment_id && prev.some(e => e.equipment_id === item.parent_equipment_id)) return prev;
      const childIds = new Set(items.filter(ei => ei.parent_equipment_id === item.equipment_id).map(ei => ei.equipment_id));
      const available = item.available_quantity ?? item.quantity;
      return [...prev.filter(e => !childIds.has(e.equipment_id)), { equipment_id: item.equipment_id, name: item.name, quantity: 1, maxQuantity: available, photo: item.photo }];
    });
  }

  function handleRemoveEquipment(equipmentId: number) {
    setSelectedEquip((prev) => prev.filter(e => e.equipment_id !== equipmentId));
  }

  function handleQuantityChange(equipmentId: number, qty: number) {
    setSelectedEquip((prev) =>
      prev.map(e => e.equipment_id === equipmentId ? { ...e, quantity: Math.max(1, Math.min(qty, e.maxQuantity)) } : e)
    );
  }

  async function handleAdd() {
    if (selectedEquip.length === 0) return;
    setSaving(true);
    try {
      await onAdd(selectedEquip.map(e => ({ equipmentId: e.equipment_id, quantity: e.quantity })));
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>إضافة ادوات</SheetTitle></SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <Input
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد نتائج</p>
            ) : (
              filtered.map(i => (
                <EquipSelectBtn key={i.equipment_id} item={i} onClick={() => handleAddEquipment(i)} disabled={selectedEquip.some(e => e.equipment_id === i.equipment_id) || !!(i.parent_equipment_id && selectedEquip.some(e => e.equipment_id === i.parent_equipment_id))} />
              ))
            )}
          </div>
          {selectedEquip.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">الادوات المختارة:</p>
              {selectedEquip.map(e => (
                <SelectedEquipRow2 key={e.equipment_id} item={e} attachments={childrenMap.get(e.equipment_id) ?? []} onQuantityChange={handleQuantityChange} onRemove={handleRemoveEquipment} />
              ))}
              <Button onClick={handleAdd} disabled={saving || selectedEquip.length === 0}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                إضافة ({selectedEquip.length})
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
  groupId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reservationId: string;
  groupId: number | undefined;
  onAdd: (accountId: number) => Promise<void>;
}) {
  const [accounts, setAccounts] = useState<{ account_id: number; username: string; real_name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !groupId) return;
    setSearch("");
    api.get<{ success: boolean; data: { account_id: number; username: string; real_name: string; access_level: string }[] }>(`/equipment/groups/${groupId}/members`)
      .then(r => setAccounts(r.data.data.filter(m => m.access_level === 'organizer')))
      .catch(() => toast.error("فشل تحميل المراجعين"));
  }, [open, groupId]);

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
