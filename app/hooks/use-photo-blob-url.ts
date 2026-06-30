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
      let foundInCache = false;

      // 1. Serve from cache immediately if available
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
            foundInCache = true;
          }
        }
      } catch {
        // Cache lookup failed — ignore
      }

      // 2. Always background-revalidate from network (stale-while-revalidate)
      //    This ensures updated photos are picked up even when the URL hasn't
      //    changed, without blocking the initial render.
      try {
        const token = localStorage.getItem("authToken");
        if (!token) throw new Error();
        const res = await fetch(photoUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error();
        // Update the cache with the fresh response
        const cache = await caches.open("photo-cache");
        await cache.put(photoUrl, res.clone());
        const blob = await res.blob();
        if (!cancelledRef.current) {
          revoke();
          const newBlobUrl = URL.createObjectURL(blob);
          objectUrlRef.current = newBlobUrl;
          setBlobUrl(newBlobUrl);
          setLoading(false);
        }
      } catch {
        if (!foundInCache && !cancelledRef.current) {
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
