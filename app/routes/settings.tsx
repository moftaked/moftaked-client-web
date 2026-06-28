import { Trash2, Bug } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { clearAllOfflineData } from "~/lib/offline-db";
import { resetTimestampCache } from "~/lib/sync-manager";
import { getConsoleBuffer } from "~/lib/console-buffer";

export default function Settings() {
  async function handleClearData() {
    const keysToRemove = ["authToken", "userRoles", "vite-ui-theme", "sidebar_state"];
    for (const key of keysToRemove) localStorage.removeItem(key);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("attendance_pending_")) localStorage.removeItem(k);
    }
    resetTimestampCache();
    await clearAllOfflineData();
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((k) => caches.delete(k)));
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="justify-start text-destructive">
            <Trash2 className="size-4" />
            مسح جميع بيانات التطبيق
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد مسح البيانات</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم مسح جميع البيانات المخزنة محلياً (ذاكرة التخزين المؤقت والبيانات المسجلة والملفات)
              وإلغاء تثبيت الخدمة العاملة. ستتم إعادة تحميل التطبيق إلى الحالة الأولية تماماً.
              هذا الإجراء لا رجعة فيه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleClearData}>
              نعم، قم بمسح الكل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant="outline"
        className="justify-start"
        onClick={() => {
          const text = getConsoleBuffer();
          navigator.clipboard.writeText(text).then(() => {
            toast.success("تم نسخ سجل الأخطاء", { duration: 3000 });
          }).catch(() => {
            toast.error("فشل نسخ سجل الأخطاء");
          });
        }}
      >
        <Bug className="size-4" />
        نسخ سجل الأخطاء
      </Button>
    </div>
  );
}
