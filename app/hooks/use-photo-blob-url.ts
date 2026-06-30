import { useEffect, useRef, useState } from "react";
import { getPhotoUrl } from "~/lib/utils";

type PhotoSize = "sm" | "md" | "lg";

interface UsePhotoBlobUrlResult {
  blobUrl: string | null;
  loading: boolean;
  error: boolean;
}

export function usePhotoBlobUrl(
  photoLink: string | null | undefined,
  size: PhotoSize = "md",
): UsePhotoBlobUrlResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const revoke = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    revoke();
    setBlobUrl(null);
    setError(false);

    const url = getPhotoUrl(photoLink, size);
    if (!url) {
      setLoading(false);
      return;
    }

    cancelledRef.current = false;
    setLoading(true);

    const photoUrl: string = url;

    async function load() {
      // 1. Try Cache Storage first (populated by prefetch-data.ts)
      try {
        const cache = await caches.open("photo-cache");
        const cached = await cache.match(photoUrl);
        if (cached) {
          const blob = await cached.blob();
          if (!cancelledRef.current) {
            const blobUrl = URL.createObjectURL(blob);
            objectUrlRef.current = blobUrl;
            setBlobUrl(blobUrl);
            setLoading(false);
          }
          return;
        }
      } catch {
        // Cache lookup failed — fall through to network
      }

      // 2. Fall back to fetching from the network
      try {
        const token = localStorage.getItem("authToken");
        if (!token) throw new Error();
        const res = await fetch(photoUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        if (!cancelledRef.current) {
          const blobUrl = URL.createObjectURL(blob);
          objectUrlRef.current = blobUrl;
          setBlobUrl(blobUrl);
          setLoading(false);
        }
      } catch {
        if (!cancelledRef.current) {
          setError(true);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelledRef.current = true;
      revoke();
    };
  }, [photoLink, size]);

  return { blobUrl, loading, error };
}
