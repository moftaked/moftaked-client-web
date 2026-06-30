import { useState, useRef, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/person";
import { usePhotoBlobUrl } from "~/hooks/use-photo-blob-url";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  User,
  Phone,
  MapPin,
  StickyNote,
  Map,
  Camera,
  Loader2,
  BookOpen,
  Maximize,
  ImageUp,
  Pencil,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "~/components/ui/sheet";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import { ImageCropper } from "~/components/image-cropper";
import { PhotoViewer } from "~/components/photo-viewer";
import { AssignPersonSheet } from "~/components/assign-person-sheet";
import { isAdmin } from "~/lib/utils";
import {
  resetTimestampCache,
  fetchAndCache,
  registerFetcher,
  unregisterFetcher,
} from "~/lib/sync-manager";
import {
  classStudentsKey,
  classTeachersKey,
  personProfileKey,
  removeCached,
} from "~/lib/offline-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonClass {
  class_id: number;
  class_name: string;
  school_name: string;
  type: "student" | "teacher";
}

interface PersonData {
  person_id: number;
  person_name: string;
  address: string | null;
  photo_link: string | null;
  notes: string | null;
  district_name: string | null;
  phone_numbers: string | null;
  type: "student" | "teacher";
  classes: PersonClass[];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { type, personId } = params;
  const personType = type as "student" | "teacher";

  const person = await fetchAndCache<PersonData>(
    personProfileKey(personId!, personType),
    async () => {
      const paramKey = personType === "student" ? "students" : "teachers";
      const res = await api.get<{ success: boolean; data: PersonData }>(
        `/persons/${paramKey}/${personId}`
      );
      return res.data.data;
    },
  );

  return {
    person,
    type: personType,
    personId: personId!,
  };
}

// ---------------------------------------------------------------------------
// Loading Fallback
// ---------------------------------------------------------------------------

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="size-5" />
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="size-32 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PersonPage({ loaderData }: Route.ComponentProps) {
  const { person, type, personId } = loaderData;
  const navigate = useNavigate();

  // Register fetcher so backgroundSync can re-fetch when data changes
  useEffect(() => {
    const key = personProfileKey(personId, type);
    registerFetcher(key, async () => {
      const paramKey = type === "student" ? "students" : "teachers";
      const res = await api.get<{ success: boolean; data: PersonData }>(
        `/persons/${paramKey}/${personId}`
      );
      return res.data.data;
    });
    return () => unregisterFetcher(key);
  }, [personId, type]);

  const [classChecking, setClassChecking] = useState<number | null>(null);
  const [photoLink, setPhotoLink] = useState(person.photo_link);

  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeLabel = type === "student" ? "مخدوم" : "خادم";

  const phones = person.phone_numbers
    ? person.phone_numbers.split(", ").filter(Boolean)
    : [];

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(person.person_name);
  const [editPhone, setEditPhone] = useState(phones[0] ?? "");
  const [editPhone2, setEditPhone2] = useState(phones[1] ?? "");
  const [editAddress, setEditAddress] = useState(person.address ?? "");
  const [editNotes, setEditNotes] = useState(person.notes ?? "");
  const [editDistrictId, setEditDistrictId] = useState<string>("");
  const [districts, setDistricts] = useState<{ district_id: number; district_name: string }[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const fetchedDistricts = useRef(false);

  // Assign sheet
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [allClasses, setAllClasses] = useState<{ class_id: number; class_name: string; school_id: number; school_name: string }[]>([]);
  const fetcheClasses = useRef(false);
  const schoolMap = useMemo(() => {
    const m = new globalThis.Map<string, { class_id: number; class_name: string; school_id: number; school_name: string }[]>();
    for (const cls of allClasses) {
      const key = cls.school_name;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(cls);
    }
    return m;
  }, [allClasses]);

  function openAssignSheet() {
    if (!fetcheClasses.current) {
      fetcheClasses.current = true;
      api.get<{ success: boolean; data: { class_id: number; class_name: string; school_id: number; school_name: string }[] }>("/accounts/classes").then((res) => {
        setAllClasses(res.data.data);
      });
    }
    setAssignSheetOpen(true);
  }

  function openEdit() {
    setEditName(person.person_name);
    setEditPhone(phones[0] ?? "");
    setEditPhone2(phones[1] ?? "");
    setEditAddress(person.address ?? "");
    setEditNotes(person.notes ?? "");
    setEditDistrictId("");
    setEditOpen(true);
    if (!fetchedDistricts.current) {
      fetchedDistricts.current = true;
      api.get<{ success: boolean; data: { district_id: number; district_name: string }[] }>("/districts").then((res) => {
        const all = res.data.data;
        setDistricts(all);
        if (person.district_name) {
          const match = all.find((d) => d.district_name === person.district_name);
          if (match) setEditDistrictId(String(match.district_id));
        }
      });
    } else if (person.district_name) {
      const match = districts.find((d) => d.district_name === person.district_name);
      if (match) setEditDistrictId(String(match.district_id));
    }
  }

  async function handleEditSave() {
    if (!editName.trim()) return;
    setEditSubmitting(true);
    try {
      const paramKey = type === "student" ? "students" : "teachers";
      await api.put(`/persons/${paramKey}/${personId}`, {
        name: editName.trim(),
        phone_number: editPhone.trim(),
        second_phone_number: editPhone2.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
        district_id: editDistrictId ? Number(editDistrictId) : null,
      });
      resetTimestampCache();
      await Promise.all(
        person.classes.map((cls) => {
          const key = cls.type === "student" ? classStudentsKey(cls.class_id) : classTeachersKey(cls.class_id);
          return removeCached(key);
        })
      );
      toast.success("تم حفظ التعديلات");
      setEditOpen(false);
      navigate(".", { replace: true });
    } catch {
      toast.error("حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setEditSubmitting(false);
    }
  }

  const { blobUrl: mediumBlobUrl, loading: photoLoading } = usePhotoBlobUrl(photoLink, "md");
  const { blobUrl: largeBlobUrl } = usePhotoBlobUrl(photoLink, "lg");

  const hasPhoto = !!mediumBlobUrl;

  // --------------------------------------------------
  // File selection handler — opens the cropper
  // --------------------------------------------------
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("نوع الملف غير مدعوم. استخدم JPEG أو PNG أو WebP");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الصورة أكبر من 10 ميجابايت");
      return;
    }

    // Create object URL for the cropper
    const objectUrl = URL.createObjectURL(file);
    setCropperImageSrc(objectUrl);
    setShowCropper(true);

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // --------------------------------------------------
  // Trigger the hidden file input
  // --------------------------------------------------
  function triggerUpload() {
    setPopoverOpen(false);
    fileInputRef.current?.click();
  }

  // --------------------------------------------------
  // Upload the cropped image
  // --------------------------------------------------
  async function handleCroppedImage(croppedBlob: Blob) {
    setShowCropper(false);
    setUploading(true);

    // Clean up the object URL
    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc);
      setCropperImageSrc(null);
    }

    try {
      const formData = new FormData();
      formData.append("photo", croppedBlob, "photo.webp");

      const paramKey = type === "student" ? "students" : "teachers";
      const res = await api.post<{
        success: boolean;
        data: { filename: string };
      }>(`/persons/${paramKey}/${personId}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPhotoLink(res.data.data.filename);

      // Invalidate class-level caches so the table view re-fetches the
      // updated photo_link instead of showing the stale cached value.
      resetTimestampCache();
      await Promise.all(
        person.classes.map((cls) => {
          const key =
            cls.type === "student"
              ? classStudentsKey(cls.class_id)
              : classTeachersKey(cls.class_id);
          return removeCached(key);
        })
      );

      toast.success("تم رفع الصورة بنجاح");
    } catch {
      toast.error("حصلت مشكلة في رفع الصورة، حاول تاني");
    } finally {
      setUploading(false);
    }
  }

  // --------------------------------------------------
  // Cancel cropper
  // --------------------------------------------------
  function handleCropperCancel() {
    setShowCropper(false);
    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc);
      setCropperImageSrc(null);
    }
  }

  // --------------------------------------------------
  // Open fullscreen viewer
  // --------------------------------------------------
  function openViewer() {
    setPopoverOpen(false);
    setViewerOpen(true);
  }

  // --------------------------------------------------
  // Handle photo area click (no photo → upload, has photo → popover)
  // --------------------------------------------------
  function handlePhotoAreaClick() {
    if (!hasPhoto) {
      triggerUpload();
    }
    // When there IS a photo, the PopoverTrigger handles the click
  }

  async function handleClassClick(classId: number) {
    setClassChecking(classId);
    try {
      await api.head(`/classes/${classId}/students`);
      navigate(`/class/${classId}`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error("ليس لديك صلاحية الوصول لهذا الفصل");
      } else {
        navigate(`/class/${classId}`);
      }
    } finally {
      setClassChecking(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto pb-8">
      {/* Photo + Name Section */}
      <div className="flex flex-col items-center gap-4">
        {/* Photo */}
        <div className="relative">
          {hasPhoto ? (
            /* --- HAS PHOTO: wrap in Popover for view / upload choice --- */
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="size-32 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border shadow-md cursor-pointer hover:ring-2 hover:ring-primary/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    key={photoLink}
                    src={mediumBlobUrl!}
                    alt={person.person_name}
                    className="size-full object-cover"
                  />
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
            /* --- NO PHOTO: click to upload directly --- */
            <button
              type="button"
              onClick={handlePhotoAreaClick}
              disabled={uploading}
              className="size-32 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border shadow-md cursor-pointer hover:border-primary/60 hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
            >
              {uploading ? (
                <Loader2 className="size-8 text-muted-foreground animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Camera className="size-8 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    رفع صورة
                  </span>
                </div>
              )}
            </button>
          )}

          {/* Uploading spinner overlay (when photo exists) */}
          {uploading && hasPhoto && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center pointer-events-none">
              <Loader2 className="size-6 text-white animate-spin" />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Upload button for mobile (since popover is available, this is simpler) */}
        {hasPhoto && (
          <Button
            variant="outline"
            size="sm"
            onClick={triggerUpload}
            disabled={uploading}
            className="md:hidden"
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جاري الرفع...
              </>
            ) : (
              <>
                <Camera className="size-4" />
                تغيير الصورة
              </>
            )}
          </Button>
        )}

        {/* Name + Type */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{person.person_name}</h1>
          <span className="text-sm text-muted-foreground">{typeLabel}</span>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">البيانات الشخصية</CardTitle>
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="size-3.5" />
            تعديل
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Phone Numbers */}
          {phones.length > 0 && (
            <InfoRow icon={Phone} label="التليفون">
              <div className="flex flex-col gap-1">
                {phones.map((phone: string, i: number) => (
                  <a
                    key={i}
                    href={`tel:${phone}`}
                    dir="ltr"
                    className="text-foreground hover:text-primary hover:underline text-end"
                  >
                    {phone}
                  </a>
                ))}
              </div>
            </InfoRow>
          )}

          {/* Address */}
          {person.address && (
            <InfoRow icon={MapPin} label="العنوان">
              <span>{person.address}</span>
            </InfoRow>
          )}

          {/* District */}
          {person.district_name && (
            <InfoRow icon={Map} label="المنطقة">
              <span>{person.district_name}</span>
            </InfoRow>
          )}

          {/* Notes */}
          {person.notes && (
            <InfoRow icon={StickyNote} label="ملاحظات">
              <span className="whitespace-pre-wrap">{person.notes}</span>
            </InfoRow>
          )}

          {/* Empty state */}
          {phones.length === 0 &&
            !person.address &&
            !person.district_name &&
            !person.notes && (
              <p className="text-sm text-muted-foreground text-center py-4">
                لا توجد بيانات مسجلة
              </p>
            )}
        </CardContent>
      </Card>

      {/* Classes Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">الفصول</CardTitle>
          {isAdmin() && (
            <Button variant="outline" size="sm" onClick={openAssignSheet}>
              <Pencil className="size-3.5" />
              تعديل
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {person.classes && person.classes.length > 0 ? (
            person.classes.map((cls: PersonClass) => (
              <button
                key={cls.class_id}
                type="button"
                disabled={classChecking === cls.class_id}
                onClick={() => handleClassClick(cls.class_id)}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors w-full text-right disabled:opacity-50"
              >
                <BookOpen className="size-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {cls.class_name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {cls.school_name}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-2 text-center">
              لا يوجد فصول
            </p>
          )}
        </CardContent>
      </Card>

      {/* Image Cropper Overlay */}
      {showCropper && cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={handleCroppedImage}
          onCancel={handleCropperCancel}
        />
      )}

      {/* Fullscreen Photo Viewer */}
      {viewerOpen && largeBlobUrl && (
        <PhotoViewer
          src={largeBlobUrl}
          alt={person.person_name}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>تعديل البيانات الشخصية</SheetTitle>
            <SheetDescription>
              قم بتعديل بيانات {person.person_name}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 py-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">الاسم</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">رقم التليفون</label>
              <Input
                dir="ltr"
                className="text-right"
                type="tel"
                inputMode="numeric"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">رقم تليفون ثاني (اختياري)</label>
              <Input
                dir="ltr"
                className="text-right"
                type="tel"
                inputMode="numeric"
                value={editPhone2}
                onChange={(e) => setEditPhone2(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">العنوان</label>
              <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">المنطقة</label>
              <Select value={editDistrictId} onValueChange={setEditDistrictId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المنطقة" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.district_id} value={String(d.district_id)}>
                      {d.district_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">ملاحظات</label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={handleEditSave} disabled={editSubmitting}>
              {editSubmitting && <Loader2 className="size-4 animate-spin" />}
              حفظ
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Assign Classes Sheet */}
      <AssignPersonSheet
        open={assignSheetOpen}
        person={{ person_id: person.person_id, person_name: person.person_name, photo_link: person.photo_link }}
        personType={type}
        classes={allClasses}
        schoolMap={schoolMap}
        onClose={() => setAssignSheetOpen(false)}
        onSuccess={() => navigate(".", { replace: true })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info Row Helper
// ---------------------------------------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 size-5 shrink-0 text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}