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

    const token = localStorage.getItem("authToken");
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    cancelledRef.current = false;
    setLoading(true);

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        if (cancelledRef.current) return;
        const blobUrl = URL.createObjectURL(blob);
        objectUrlRef.current = blobUrl;
        setBlobUrl(blobUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelledRef.current) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelledRef.current = true;
      revoke();
    };
  }, [photoLink, size]);

  return { blobUrl, loading, error };
}
