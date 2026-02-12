import { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface PhotoViewerProps {
  /** Full URL of the large photo to display */
  src: string;
  /** Alt text for the image */
  alt?: string;
  /** Called when the viewer should close */
  onClose: () => void;
}

/**
 * Fullscreen overlay that displays a large profile photo.
 * Closes on backdrop click, close button click, or Escape key.
 */
export function PhotoViewer({ src, alt = "", onClose }: PhotoViewerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    // Lock body scroll while the viewer is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "عرض الصورة"}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        aria-label="إغلاق"
      >
        <X className="size-6" />
      </button>

      {/* Image – stop propagation so clicking the image doesn't close the viewer */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] max-w-[90dvw] rounded-lg object-contain shadow-2xl animate-in zoom-in-90 duration-200"
        draggable={false}
      />
    </div>
  );
}