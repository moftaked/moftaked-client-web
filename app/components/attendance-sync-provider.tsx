import { useEffect, useRef } from "react";
import { flushAllPending, getAllPendingKeys } from "~/lib/attendance-sync";
import { toast } from "sonner";

/**
 * AttendanceSyncProvider
 *
 * Renders no UI of its own. Place it once near the app root (inside providers
 * that supply the auth token, etc.).
 *
 * On mount and whenever the browser comes back online it checks localStorage
 * for any pending attendance changes that were queued while offline (or that
 * failed to flush earlier) and tries to send them to the server.
 *
 * A sonner toast is shown when a background flush completes (success or
 * partial failure).
 */
export function AttendanceSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const flushingRef = useRef(false);

  async function tryFlush() {
    // Quick-check: anything pending at all?
    if (getAllPendingKeys().length === 0) return;
    // Prevent overlapping flushes
    if (flushingRef.current) return;
    flushingRef.current = true;

    try {
      const { flushed, failed } = await flushAllPending();

      if (flushed > 0 && failed === 0) {
        toast.success("تم مزامنة بيانات الحضور المعلّقة بنجاح");
      } else if (flushed > 0 && failed > 0) {
        toast.warning(
          `تم مزامنة ${flushed} بنجاح، وفشل ${failed} — سيتم إعادة المحاولة لاحقًا`
        );
      } else if (flushed === 0 && failed > 0) {
        toast.error(
          "فشل مزامنة بيانات الحضور المعلّقة — سيتم إعادة المحاولة عند عودة الاتصال"
        );
      }
    } finally {
      flushingRef.current = false;
    }
  }

  useEffect(() => {
    // Flush on mount (app start)
    tryFlush();

    // Flush when the browser comes back online
    function handleOnline() {
      tryFlush();
    }

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}