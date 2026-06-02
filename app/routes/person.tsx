import { useState, useRef } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/person";
import { getPhotoUrl } from "~/lib/utils";
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
  ArrowRight,
  BookOpen,
  Maximize,
  ImageUp,
} from "lucide-react";
import { toast } from "sonner";
import { ImageCropper } from "~/components/image-cropper";
import { PhotoViewer } from "~/components/photo-viewer";
import { resetTimestampCache } from "~/lib/sync-manager";
import {
  classStudentsKey,
  classTeachersKey,
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

  const paramKey = type === "student" ? "students" : "teachers";
  const res = await api.get<{ success: boolean; data: PersonData }>(
    `/persons/${paramKey}/${personId}`
  );

  return {
    person: res.data.data,
    type: type as "student" | "teacher",
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
  const [photoLink, setPhotoLink] = useState(person.photo_link);
  const [photoVersion, setPhotoVersion] = useState(0);
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

  // Build photo URLs with cache-busting version param
  const rawMediumUrl = getPhotoUrl(photoLink, "md");
  const rawLargeUrl = getPhotoUrl(photoLink, "lg");
  const mediumPhotoUrl =
    rawMediumUrl && photoLink
      ? `${rawMediumUrl}${photoVersion ? `?v=${photoVersion}` : ""}`
      : null;
  const largePhotoUrl =
    rawLargeUrl && photoLink
      ? `${rawLargeUrl}${photoVersion ? `?v=${photoVersion}` : ""}`
      : null;

  const hasPhoto = !!mediumPhotoUrl;

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
      // Bump version to bust browser cache for the new image
      setPhotoVersion((v) => v + 1);

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

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto pb-8">
      {/* Back button */}
      <Link
        to={-1 as any}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowRight className="size-4" />
        رجوع
      </Link>

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
                    src={mediumPhotoUrl!}
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
        <CardHeader>
          <CardTitle className="text-lg">البيانات الشخصية</CardTitle>
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
                    className="text-primary hover:underline text-end"
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
      {person.classes && person.classes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الفصول</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {person.classes.map((cls: PersonClass) => (
              <Link
                key={cls.class_id}
                to={`/class/${cls.class_id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors"
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
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Image Cropper Overlay */}
      {showCropper && cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={handleCroppedImage}
          onCancel={handleCropperCancel}
        />
      )}

      {/* Fullscreen Photo Viewer */}
      {viewerOpen && largePhotoUrl && (
        <PhotoViewer
          src={largePhotoUrl}
          alt={person.person_name}
          onClose={() => setViewerOpen(false)}
        />
      )}
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