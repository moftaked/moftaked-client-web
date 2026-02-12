import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Button } from "~/components/ui/button";
import { Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageCropperProps {
  /** The source image URL (object URL or data URL) to crop */
  imageSrc: string;
  /** Called with the cropped square blob when the user confirms */
  onCropComplete: (croppedBlob: Blob) => void | Promise<void>;
  /** Called when the user cancels */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given a source image and a crop area (in pixels), return a square WebP Blob.
 */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas 2D context not available");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create cropped image blob"));
      },
      "image/webp",
      0.9,
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = useCallback(
    (_croppedArea: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels);
    },
    [],
  );

  async function handleConfirm() {
    if (!croppedAreaPixels) return;

    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      await onCropComplete(blob);
    } catch {
      // Error is handled by the parent
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Cropper area */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={handleCropComplete}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 px-4 py-4 bg-black/80 backdrop-blur-sm">
        {/* Zoom control */}
        <div className="flex items-center gap-3 text-white">
          <ZoomOut className="size-4 shrink-0 opacity-70" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-white h-1"
          />
          <ZoomIn className="size-4 shrink-0 opacity-70" />
        </div>

        {/* Rotation */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:text-white hover:bg-white/20"
            onClick={() => setRotation((r) => (r + 90) % 360)}
          >
            <RotateCw className="size-4" />
            تدوير
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white"
            onClick={onCancel}
            disabled={processing}
          >
            إلغاء
          </Button>
          <Button
            className="flex-1 bg-white text-black hover:bg-white/90"
            onClick={handleConfirm}
            disabled={processing || !croppedAreaPixels}
          >
            {processing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جاري المعالجة...
              </>
            ) : (
              "تأكيد"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}