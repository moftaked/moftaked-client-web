import { useState, useRef } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/person";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
} from "lucide-react";
import { toast } from "sonner";

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = import.meta.env.VITE_API_URL ?? "";
  const typeLabel = type === "student" ? "مخدوم" : "خادم";

  const phones = person.phone_numbers
    ? person.phone_numbers.split(", ").filter(Boolean)
    : [];

  // --------------------------------------------------
  // Photo upload handler
  // --------------------------------------------------
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("نوع الملف غير مدعوم. استخدم JPEG أو PNG أو WebP");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة أكبر من 5 ميجابايت");
      return;
    }

    setUploading(true);

    try {
      // Convert to WebP using canvas for optimal size
      const webpBlob = await convertToWebp(file);

      const formData = new FormData();
      formData.append("photo", webpBlob, "photo.webp");

      const paramKey = type === "student" ? "students" : "teachers";
      const res = await api.post<{
        success: boolean;
        data: { filename: string };
      }>(`/persons/${paramKey}/${personId}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPhotoLink(res.data.data.filename);
      toast.success("تم رفع الصورة بنجاح");
    } catch {
      toast.error("حصلت مشكلة في رفع الصورة، حاول تاني");
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
        <div className="relative group">
          <div className="size-32 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border shadow-md">
            {photoLink ? (
              <img
                src={`${apiUrl}/uploads/images/${photoLink}`}
                alt={person.person_name}
                className="size-full object-cover"
              />
            ) : (
              <User className="size-16 text-muted-foreground" />
            )}
          </div>

          {/* Upload overlay */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
          >
            {uploading ? (
              <Loader2 className="size-6 text-white animate-spin" />
            ) : (
              <Camera className="size-6 text-white" />
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>

        {/* Upload button for mobile (since hover isn't available) */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
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
              {photoLink ? "تغيير الصورة" : "رفع صورة"}
            </>
          )}
        </Button>

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

// ---------------------------------------------------------------------------
// WebP Conversion
// ---------------------------------------------------------------------------

function convertToWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Resize if too large (max 1200px on longest side)
      const MAX_SIZE = 1200;
      let { width, height } = img;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert image to WebP"));
          }
        },
        "image/webp",
        0.82
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}