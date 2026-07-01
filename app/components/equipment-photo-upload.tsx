import { useState, useRef } from "react";
import api from "~/lib/api";
import { ImageCropper } from "~/components/image-cropper";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Loader2, ImageUp } from "lucide-react";
import { toast } from "sonner";

interface EquipmentPhotoUploadProps {
  groupId: string;
  itemId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EquipmentPhotoUpload({
  groupId,
  itemId,
  open,
  onOpenChange,
  onSuccess,
}: EquipmentPhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCropperImageSrc(objectUrl);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCropComplete(croppedBlob: Blob) {
    setCropperImageSrc(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", croppedBlob, "photo.webp");
      await api.post(
        `/equipment/groups/${groupId}/items/${itemId}/photo`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success("تم رفع الصورة");
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  function handleCropperCancel() {
    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc);
      setCropperImageSrc(null);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropperCancel}
        />
      )}

      <Sheet open={open && !cropperImageSrc} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="flex flex-col gap-4 pb-8">
          <SheetHeader>
            <SheetTitle>صورة</SheetTitle>
          </SheetHeader>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageUp className="size-4" />
            )}
            اختر صورة
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
