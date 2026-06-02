import { useState } from "react";
import { User } from "lucide-react";
import { cn, getPhotoUrl } from "~/lib/utils";
import { PhotoViewer } from "~/components/photo-viewer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AvatarSize = "sm" | "md" | "lg";

interface PersonAvatarProps {
  /** The base photo_link stored in the database (or null if no photo) */
  photoLink: string | null | undefined;
  /** Display name – used for alt text and initials fallback */
  name: string;
  /** Which size variant to display */
  size?: AvatarSize;
  /** Whether clicking the avatar opens a fullscreen viewer with the large photo */
  clickToView?: boolean;
  /** Optional version to bust the browser cache when the photo changes */
  version?: number | string;
  /** Additional class names for the outer wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Size config
// ---------------------------------------------------------------------------

const SIZE_CONFIG: Record<
  AvatarSize,
  {
    wrapper: string;
    icon: string;
    photoSize: "sm" | "md" | "lg";
    border: string;
    initialsText: string;
  }
> = {
  sm: {
    wrapper: "size-7",
    icon: "size-3.5",
    photoSize: "sm",
    border: "border",
    initialsText: "text-[10px] font-semibold",
  },
  md: {
    wrapper: "size-32",
    icon: "size-16",
    photoSize: "md",
    border: "border-2",
    initialsText: "text-3xl font-bold",
  },
  lg: {
    wrapper: "size-64",
    icon: "size-32",
    photoSize: "lg",
    border: "border-2",
    initialsText: "text-5xl font-bold",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract up to 2 initials from an Arabic or Latin name.
 * For Arabic names it picks the first letter of the first and last word.
 * Returns uppercase for Latin, as-is for Arabic.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]![0] ?? "";
  return (parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PersonAvatar({
  photoLink,
  name,
  size = "md",
  clickToView = false,
  version,
  className,
}: PersonAvatarProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const config = SIZE_CONFIG[size];
  const rawPhotoUrl = getPhotoUrl(photoLink, config.photoSize);
  const largePhotoUrl = getPhotoUrl(photoLink, "lg");
  const photoUrl =
    rawPhotoUrl && version
      ? `${rawPhotoUrl}${version ? `?v=${version}` : ""}`
      : rawPhotoUrl;
  const hasPhoto = !!photoUrl && !imgError;

  const isClickable = clickToView && !!largePhotoUrl && hasPhoto;

  function handleClick() {
    if (isClickable) {
      setViewerOpen(true);
    }
  }

  // For sm size without a photo, show initials instead of the generic icon
  const showInitials = !hasPhoto && size === "sm";
  const initials = showInitials ? getInitials(name) : "";

  return (
    <>
      <div
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") handleClick();
              }
            : undefined
        }
        className={cn(
          "rounded-full bg-muted flex items-center justify-center overflow-hidden border-border shrink-0",
          config.wrapper,
          config.border,
          size === "sm" ? "shadow-none" : "shadow-sm",
          isClickable &&
            "cursor-pointer hover:ring-2 hover:ring-primary/40 transition-shadow",
          className,
        )}
      >
        {hasPhoto ? (
          <img
            src={photoUrl!}
            alt={name}
            className="size-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : showInitials ? (
          <span
            className={cn(
              "text-muted-foreground select-none leading-none",
              config.initialsText,
            )}
          >
            {initials}
          </span>
        ) : (
          <User className={cn("text-muted-foreground", config.icon)} />
        )}
      </div>

      {/* Fullscreen photo viewer */}
      {viewerOpen && largePhotoUrl && (
        <PhotoViewer
          src={largePhotoUrl}
          alt={name}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}