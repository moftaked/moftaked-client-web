import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isAuthenticated() {
  if (!localStorage.getItem('authToken')) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

export interface UserRole {
  role: string;
  class_id: number;
  school_id: number;
}

/**
 * Parse the roles string stored in localStorage after login.
 * The server returns roles as a JSON-stringified array of objects with
 * { role, class_id, school_id }.
 */
export function getUserRoles(): UserRole[] {
  try {
    const raw = localStorage.getItem("userRoles");
    if (!raw) return [];
    return JSON.parse(raw) as UserRole[];
  } catch {
    return [];
  }
}

/**
 * Whether the current user holds the "admin" role in any class.
 */
export function isAdmin(): boolean {
  if (localStorage.getItem('isAdmin') === 'true') {
    return true;
  }
  return getUserRoles().some((r) => r.role === "admin");
}

/**
 * Whether the current user holds the "manager" role (or admin) in any class.
 */
export function isManager(): boolean {
  if (localStorage.getItem('isAdmin') === 'true') {
    return true;
  }
  return getUserRoles().some((r) => r.role === "manager" || r.role === "admin");
}

/**
 * Whether the current user holds the "leader" role (or higher) in any class.
 */
export function isLeaderOrAbove(): boolean {
  if (localStorage.getItem('isAdmin') === 'true') {
    return true;
  }
  return getUserRoles().some((r) => r.role === "leader" || r.role === "manager" || r.role === "admin");
}

// ---------------------------------------------------------------------------
// Photo URL helpers
// ---------------------------------------------------------------------------

type PhotoSize = "sm" | "md" | "lg";

const API_URL = typeof window !== "undefined"
  ? (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")
  : "";

/**
 * Build the full URL for a person's photo at the requested size.
 *
 * The server stores a base filename (e.g. "photo-1234567890-123456789") and
 * generates three variants:
 *   {base}-sm.webp   (64×64)
 *   {base}-md.webp   (256×256)
 *   {base}-lg.webp   (800×800)
 *
 * Legacy entries may still have a full filename like "photo-xxx.webp".
 * In that case we strip the extension before appending the size suffix.
 *
 * Returns `null` when there is no photo.
 */
export function getPhotoUrl(
  photoLink: string | null | undefined,
  size: PhotoSize = "md",
): string | null {
  if (!photoLink) return null;

  const base = photoLink.replace(/\.webp$/, "").replace(/-(sm|md|lg)$/, "");
  return `${API_URL}/persons/photos/${base}-${size}.webp`;
}

/**
 * Fetch an authenticated photo URL and return a blob URL.
 * Falls back to `null` when the user is not logged in or the fetch fails.
 */
export async function fetchPhotoBlobUrl(
  photoLink: string | null | undefined,
  size: PhotoSize = "md",
): Promise<string | null> {
  const url = getPhotoUrl(photoLink, size);
  if (!url) return null;

  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  if (!token) return null;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}


