import { useState, useRef, useEffect } from "react";
import type { Route } from "./+types/equipment-item";
import api from "~/lib/api";
import { getEquipmentPhotoUrl } from "~/lib/utils";
import { usePhotoBlobUrl } from "~/hooks/use-photo-blob-url";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { ImageCropper } from "~/components/image-cropper";
import { PhotoViewer } from "~/components/photo-viewer";
import { Link, useNavigate, useRevalidator } from "react-router";
import { Pencil, Trash2, Loader2, Camera, Maximize, ImageUp, Paperclip, Plus, ImageIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { forceFetchAndCache, resetTimestampCache } from "~/lib/sync-manager";
import { equipmentGroupItemsKey, equipmentItemAttachmentsKey, removeCached } from "~/lib/offline-db";
import { toast } from "sonner";

interface EquipmentItemDetail {
  equipment_id: number;
  group_id: number;
  subgroup_id: number | null;
  parent_equipment_id: number | null;
  name: string;
  description: string | null;
  quantity: number;
  photo: string | null;
}

interface EquipmentAttachment {
  equipment_id: number;
  group_id: number;
  subgroup_id: number | null;
  parent_equipment_id: number | null;
  name: string;
  description: string | null;
  quantity: number;
  photo: string | null;
}

interface EquipmentSubgroup {
  subgroup_id: number;
  name: string;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const groupId = params.groupId;
  const itemId = params.itemId;

  let accessLevel: string | null = null;
  let subgroups: EquipmentSubgroup[] = [];
  try {
    const [groupsRes, subgroupsRes] = await Promise.all([
      api.get<{ success: boolean; data: { group_id: number; access_level: string }[] }>("/equipment/groups"),
      api.get<{ success: boolean; data: EquipmentSubgroup[] }>(`/equipment/groups/${groupId}/subgroups`),
    ]);
    const group = groupsRes.data.data.find((g: any) => String(g.group_id) === groupId);
    accessLevel = group?.access_level ?? null;
    subgroups = subgroupsRes.data.data;
  } catch {}

  const res = await api.get<{ success: boolean; data: EquipmentItemDetail }>(
    `/equipment/groups/${groupId}/items/${itemId}`
  );
  const item = res.data.data;
  let attachments: EquipmentAttachment[] = [];
  let parentItem: EquipmentItemDetail | null = null;
  if (!item.parent_equipment_id) {
    attachments = await forceFetchAndCache<EquipmentAttachment[]>(
      equipmentItemAttachmentsKey(itemId),
      () => api.get(`/equipment/groups/${groupId}/items/${itemId}/attachments`).then(r => r.data.data),
    ).catch(() => [] as EquipmentAttachment[]);
  } else {
    parentItem = await api.get<{ success: boolean; data: EquipmentItemDetail }>(
      `/equipment/groups/${groupId}/items/${item.parent_equipment_id}`
    ).then(r => r.data.data).catch(() => null);
  }
  return { item, groupId, accessLevel, subgroups, attachments, parentItem };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export default function EquipmentItem({ loaderData }: Route.ComponentProps) {
  const { item, groupId, accessLevel, subgroups, attachments, parentItem } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [editOpen, setEditOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [photoLink, setPhotoLink] = useState(item.photo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachOpen, setAttachOpen] = useState(false);
  const [attachEdit, setAttachEdit] = useState<EquipmentAttachment | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const isOrganizer = accessLevel === "organizer";
  const hasPhoto = !!photoLink;
  const subgroupName = item.subgroup_id
    ? subgroups.find((sg) => sg.subgroup_id === item.subgroup_id)?.name
    : null;

  const { blobUrl: largeBlobUrl, loading: largeLoading } = usePhotoBlobUrl(
    photoLink, "lg", getEquipmentPhotoUrl,
  );

  async function handleDelete() {
    try {
      await api.delete(`/equipment/groups/${groupId}/items/${item.equipment_id}`);
      resetTimestampCache();
      await removeCached(equipmentGroupItemsKey(groupId));
      toast.success("تم الحذف");
      navigate(`/equipment/${groupId}`);
    } catch {
      toast.error("فشل الحذف");
    }
  }

  async function handleCreateAttachment(data: { name: string; description?: string; quantity: number }) {
    try {
      await api.post(`/equipment/groups/${groupId}/items/${item.equipment_id}/attachments`, data);
      resetTimestampCache();
      await removeCached(equipmentItemAttachmentsKey(item.equipment_id));
      await removeCached(equipmentGroupItemsKey(groupId));
      revalidator.revalidate();
      toast.success("تم إنشاء الملحق");
    } catch {
      toast.error("فشل إنشاء الملحق");
    }
  }

  async function handleUpdateAttachment(attachmentId: number, data: { name?: string; description?: string | null; quantity?: number }) {
    try {
      await api.put(`/equipment/groups/${groupId}/items/${item.equipment_id}/attachments/${attachmentId}`, data);
      resetTimestampCache();
      await removeCached(equipmentItemAttachmentsKey(item.equipment_id));
      await removeCached(equipmentGroupItemsKey(groupId));
      revalidator.revalidate();
      toast.success("تم تحديث الملحق");
    } catch {
      toast.error("فشل تحديث الملحق");
    }
  }

  async function handleDeleteAttachment(attachmentId: number) {
    try {
      await api.delete(`/equipment/groups/${groupId}/items/${attachmentId}`);
      resetTimestampCache();
      await removeCached(equipmentItemAttachmentsKey(item.equipment_id));
      await removeCached(equipmentGroupItemsKey(groupId));
      revalidator.revalidate();
      toast.success("تم حذف الملحق");
    } catch {
      toast.error("فشل حذف الملحق");
    }
  }

  async function handleAssignParent(parentId: number | null) {
    const oldParentId = item.parent_equipment_id;
    try {
      await api.patch(`/equipment/groups/${groupId}/items/${item.equipment_id}/parent`, {
        parent_equipment_id: parentId,
      });
      resetTimestampCache();
      await Promise.all([
        removeCached(equipmentGroupItemsKey(groupId)),
        removeCached(equipmentItemAttachmentsKey(item.equipment_id)),
        ...oldParentId ? [removeCached(equipmentItemAttachmentsKey(oldParentId))] : [],
        ...parentId ? [removeCached(equipmentItemAttachmentsKey(parentId))] : [],
      ]);
      revalidator.revalidate();
      setAssignOpen(false);
      toast.success(parentId ? "تم التعيين كملحق" : "تم إلغاء التعيين");
    } catch {
      toast.error("فشلت العملية");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("نوع الملف غير مدعوم. استخدم JPEG أو PNG أو WebP");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الصورة أكبر من 10 ميجابايت");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropperImageSrc(objectUrl);
    setShowCropper(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function triggerUpload() {
    setPopoverOpen(false);
    fileInputRef.current?.click();
  }

  async function handleCroppedImage(croppedBlob: Blob) {
    setShowCropper(false);
    setUploading(true);

    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc);
      setCropperImageSrc(null);
    }

    try {
      const formData = new FormData();
      formData.append("photo", croppedBlob, "photo.webp");

      const res = await api.post<{ success: boolean; data: { filename: string } }>(
        `/equipment/groups/${groupId}/items/${item.equipment_id}/photo`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      setPhotoLink(res.data.data.filename);
      resetTimestampCache();
      await removeCached(equipmentGroupItemsKey(groupId));
      if (item.parent_equipment_id) {
        await removeCached(equipmentItemAttachmentsKey(item.parent_equipment_id));
      }

      toast.success("تم رفع الصورة بنجاح");
    } catch {
      toast.error("حصلت مشكلة في رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  function handleCropperCancel() {
    setShowCropper(false);
    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc);
      setCropperImageSrc(null);
    }
  }

  function openViewer() {
    setPopoverOpen(false);
    setViewerOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {showCropper && cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={handleCroppedImage}
          onCancel={handleCropperCancel}
        />
      )}

      {viewerOpen && largeBlobUrl && (
        <PhotoViewer
          src={largeBlobUrl}
          alt={item.name}
          onClose={() => setViewerOpen(false)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{item.name}</h1>
          {subgroupName && (
            <span className="text-sm text-muted-foreground">· {subgroupName}</span>
          )}
        </div>
        {isOrganizer && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                  <AlertDialogDescription>حذف هذا العنصر؟</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>لأ</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>أكيد</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {isOrganizer && item.parent_equipment_id && (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">ملحق لـ:</span>
            {parentItem ? (
              <Link
                to={`/equipment/${groupId}/${parentItem.equipment_id}`}
                className="font-medium hover:underline"
              >
                {parentItem.name}
              </Link>
            ) : (
              <Skeleton className="h-4 w-20" />
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => handleAssignParent(null)}>
            إلغاء التعيين
          </Button>
        </div>
      )}

      {isOrganizer && !item.parent_equipment_id && (
        <Button variant="outline" className="w-full" onClick={() => setAssignOpen(true)}>
          <Paperclip className="size-4" />
          تعيين كملحق
        </Button>
      )}

      <div className="relative">
        {hasPhoto ? (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {largeLoading ? (
                  <Skeleton className="w-full h-48 rounded-xl" />
                ) : (
                  <img
                    key={photoLink}
                    src={largeBlobUrl!}
                    alt={item.name}
                    className="w-full h-48 object-contain"
                  />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1.5" align="center">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={openViewer}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-start"
                >
                  <Maximize className="size-4 shrink-0" />
                  عرض الصورة
                </button>
                <button
                  type="button"
                  onClick={triggerUpload}
                  disabled={uploading}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-start disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <ImageUp className="size-4 shrink-0" />
                  )}
                  تغيير الصورة
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <button
            type="button"
            onClick={triggerUpload}
            disabled={uploading}
            className="w-full h-48 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
          >
            {uploading ? (
              <Loader2 className="size-8 text-muted-foreground animate-spin" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Camera className="size-8 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">رفع صورة</span>
              </div>
            )}
          </button>
        )}

        {uploading && hasPhoto && (
          <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center pointer-events-none">
            <Loader2 className="size-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {(item.description || item.quantity !== 1) && (
        <Card>
          <CardContent className="p-4 flex flex-col gap-3">
            {item.description && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">الوصف</p>
                <p>{item.description}</p>
              </div>
            )}
            {item.quantity !== 1 && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">الكمية</p>
                <Badge variant="secondary">{item.quantity}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!item.parent_equipment_id && attachments.length > 0 && (
        <Card>
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Paperclip className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">الملحقات</h2>
            </div>
            <div className="flex flex-col gap-2">
              {attachments.map((att: EquipmentAttachment) => (
                <AttachmentRow
                  key={att.equipment_id}
                  attachment={att}
                  groupId={groupId}
                  isOrganizer={isOrganizer}
                  onEdit={(a) => { setAttachEdit(a); setAttachOpen(true); }}
                  onDelete={handleDeleteAttachment}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isOrganizer && !item.parent_equipment_id && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => { setAttachEdit(null); setAttachOpen(true); }}>
          <Plus className="size-4 ml-1" />
          إضافة ملحق
        </Button>
      )}

      <AttachmentForm
        open={attachOpen}
        onOpenChange={(open) => { setAttachOpen(open); if (!open) setAttachEdit(null); }}
        attachment={attachEdit}
        onCreate={handleCreateAttachment}
        onUpdate={handleUpdateAttachment}
      />

      <AssignParentSheet
        open={assignOpen}
        onOpenChange={setAssignOpen}
        groupId={groupId}
        excludeId={item.equipment_id}
        onAssign={handleAssignParent}
      />

      <EditItemSheet
        item={item}
        groupId={groupId}
        subgroups={subgroups}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          resetTimestampCache();
          removeCached(equipmentGroupItemsKey(groupId));
          revalidator.revalidate();
        }}
      />
    </div>
  );
}

function AttachmentForm({
  open,
  onOpenChange,
  attachment,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: EquipmentAttachment | null;
  onCreate: (data: { name: string; description?: string; quantity: number }) => Promise<void>;
  onUpdate: (attachmentId: number, data: { name?: string; description?: string | null; quantity?: number }) => Promise<void>;
}) {
  const isEdit = attachment !== null;
  const [name, setName] = useState(attachment?.name ?? "");
  const [description, setDescription] = useState(attachment?.description ?? "");
  const [quantity, setQuantity] = useState(String(attachment?.quantity ?? 1));
  const [loading, setLoading] = useState(false);

  function reset() {
    setName(attachment?.name ?? "");
    setDescription(attachment?.description ?? "");
    setQuantity(String(attachment?.quantity ?? 1));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await onUpdate(attachment!.equipment_id, {
          name: name.trim(),
          description: description.trim() || null,
          quantity: Math.max(1, parseInt(quantity, 10) || 1),
        });
      } else {
        await onCreate({
          name: name.trim(),
          description: description.trim() || undefined,
          quantity: Math.max(1, parseInt(quantity, 10) || 1),
        });
      }
      onOpenChange(false);
    } catch {
      toast.error(isEdit ? "فشل تحديث الملحق" : "فشل إنشاء الملحق");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8">
        <SheetHeader>
          <SheetTitle>{isEdit ? "تعديل الملحق" : "ملحق جديد"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
          <Input
            placeholder="اسم الملحق"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <textarea
            placeholder="وصف (اختياري)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <label className="text-sm font-medium text-muted-foreground">
            الكمية
            <Input
              type="number"
              min={1}
              placeholder="عدد القطع المتوفرة"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
            />
          </label>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "حفظ" : "إنشاء"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AttachmentRow({
  attachment,
  groupId,
  isOrganizer,
  onEdit,
  onDelete,
}: {
  attachment: EquipmentAttachment;
  groupId: string;
  isOrganizer: boolean;
  onEdit: (att: EquipmentAttachment) => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const navigate = useNavigate();
  const { blobUrl } = usePhotoBlobUrl(attachment.photo, "sm", getEquipmentPhotoUrl);

  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-2 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => navigate(`/equipment/${groupId}/items/${attachment.equipment_id}`)}
    >
      {blobUrl ? (
        <div className="size-14 rounded-md overflow-hidden shrink-0 bg-muted">
          <img src={blobUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="size-14 rounded-md bg-muted flex items-center justify-center shrink-0">
          <ImageIcon className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{attachment.name}</p>
        {attachment.description && (
          <p className="text-xs text-muted-foreground truncate">{attachment.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {attachment.quantity !== 1 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 h-5">{attachment.quantity}</Badge>
        )}
        {isOrganizer && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(attachment); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="size-3.5" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                  <AlertDialogDescription>حذف الملحق {attachment.name}؟</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>لأ</AlertDialogCancel>
                  <AlertDialogAction onClick={(e) => { e.stopPropagation(); onDelete(attachment.equipment_id); }}>أكيد</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}

function AssignParentSheet({
  open,
  onOpenChange,
  groupId,
  excludeId,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  excludeId: number;
  onAssign: (parentId: number | null) => Promise<void>;
}) {
  const [items, setItems] = useState<EquipmentItemDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get<{ success: boolean; data: EquipmentItemDetail[] }>(
      `/equipment/groups/${groupId}/items`,
    ).then((res) => {
      setItems(res.data.data.filter((i) => i.equipment_id !== excludeId && !i.parent_equipment_id));
    }).catch(() => {
      toast.error("فشل تحميل العناصر");
    }).finally(() => {
      setLoading(false);
    });
  }, [open, groupId, excludeId]);

  const filtered = search.trim()
    ? items.filter((i) => i.name.includes(search.trim()))
    : items;

  async function handleSelect(id: number) {
    setAssigning(id);
    await onAssign(id);
    setAssigning(null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8">
        <SheetHeader>
          <SheetTitle>تعيين كملحق لـ</SheetTitle>
        </SheetHeader>
        <Input
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-col gap-2 overflow-y-auto max-h-80">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search.trim() ? "لا توجد نتائج" : "لا توجد عناصر متاحة"}
            </p>
          ) : (
            filtered.map((i) => (
              <button
                key={i.equipment_id}
                type="button"
                disabled={assigning === i.equipment_id}
                onClick={() => handleSelect(i.equipment_id)}
                className="flex items-center gap-3 rounded-lg border p-2 text-start hover:bg-accent/50 transition-colors disabled:opacity-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{i.name}</p>
                  {i.description && (
                    <p className="text-xs text-muted-foreground truncate">{i.description}</p>
                  )}
                </div>
                {assigning === i.equipment_id && (
                  <Loader2 className="size-4 animate-spin shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditItemSheet({
  item,
  groupId,
  subgroups: initialSubgroups,
  open,
  onOpenChange,
  onSuccess,
}: {
  item: EquipmentItemDetail;
  groupId: string;
  subgroups: EquipmentSubgroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [subgroupId, setSubgroupId] = useState<string>(String(item.subgroup_id ?? "none"));
  const [loading, setLoading] = useState(false);
  const [showNewSubgroup, setShowNewSubgroup] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState("");
  const [creatingSubgroup, setCreatingSubgroup] = useState(false);
  const [subgroups, setSubgroups] = useState(initialSubgroups);

  useEffect(() => {
    setSubgroups(initialSubgroups);
  }, [initialSubgroups]);

  async function handleCreateSubgroup() {
    if (!newSubgroupName.trim()) return;
    setCreatingSubgroup(true);
    try {
      const res = await api.post<{ success: boolean; data: { subgroup_id: number } }>(
        `/equipment/groups/${groupId}/subgroups`,
        { name: newSubgroupName.trim() },
      );
      const newSg: EquipmentSubgroup = {
        subgroup_id: res.data.data.subgroup_id,
        name: newSubgroupName.trim(),
      };
      setSubgroups((prev) => [...prev, newSg]);
      setSubgroupId(String(newSg.subgroup_id));
      setNewSubgroupName("");
      setShowNewSubgroup(false);
      toast.success("تم إنشاء الصنف");
    } catch {
      toast.error("فشل إنشاء الصنف");
    } finally {
      setCreatingSubgroup(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
      };
      if (subgroupId !== "none") {
        payload.subgroup_id = parseInt(subgroupId, 10);
      } else {
        payload.subgroup_id = null;
      }
      await api.put(`/equipment/groups/${groupId}/items/${item.equipment_id}`, payload);
      toast.success("تم التحديث");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("فشل التحديث");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8">
        <SheetHeader>
          <SheetTitle>تعديل العنصر</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
          <Input
            placeholder="اسم العنصر"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <textarea
            placeholder="وصف (اختياري)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <label className="text-sm font-medium text-muted-foreground">
            الكمية
            <Input
              type="number"
              min={1}
              placeholder="عدد القطع المتوفرة"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
            />
          </label>
          <div>
            <label className="text-sm font-medium text-muted-foreground">الصنف</label>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1">
                <Select value={subgroupId} onValueChange={setSubgroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="صنف (اختياري)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    {subgroups.map((sg: EquipmentSubgroup) => (
                      <SelectItem key={sg.subgroup_id} value={String(sg.subgroup_id)}>
                        {sg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setShowNewSubgroup(true)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {showNewSubgroup && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  placeholder="اسم الصنف"
                  value={newSubgroupName}
                  onChange={(e) => setNewSubgroupName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={creatingSubgroup || !newSubgroupName.trim()}
                  onClick={handleCreateSubgroup}
                >
                  {creatingSubgroup ? <Loader2 className="size-3 animate-spin" /> : "إنشاء"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowNewSubgroup(false); setNewSubgroupName(""); }}
                >
                  إلغاء
                </Button>
              </div>
            )}
          </div>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            حفظ
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}


