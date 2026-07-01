import { useState, useRef } from "react";
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
import { useNavigate, useRevalidator } from "react-router";
import { Pencil, Trash2, Loader2, Camera, Maximize, ImageUp } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { resetTimestampCache } from "~/lib/sync-manager";
import { equipmentGroupItemsKey, removeCached } from "~/lib/offline-db";
import { toast } from "sonner";

interface EquipmentItemDetail {
  equipment_id: number;
  group_id: number;
  subgroup_id: number | null;
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
  return { item: res.data.data, groupId, accessLevel, subgroups };
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
  const { item, groupId, accessLevel, subgroups } = loaderData;
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
                <p>{item.description}</p>
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

function EditItemSheet({
  item,
  groupId,
  subgroups,
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
          {subgroups.length > 0 && (
            <label className="text-sm font-medium text-muted-foreground">
              المجموعة الفرعية
              <Select value={subgroupId} onValueChange={setSubgroupId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="مجموعة فرعية (اختياري)" />
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
            </label>
          )}
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            حفظ
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}


