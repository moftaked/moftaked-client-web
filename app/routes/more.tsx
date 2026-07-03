import { useState, useEffect } from "react";
import { Logout } from "~/components/logout";
import { ModeToggle } from "~/components/mode-toggle";
import { isAdmin } from "~/lib/utils";
import { Link } from "react-router";
import { ShieldCheck, School, CalendarDays, MapPin, Trash2, Bug, Settings, Bell } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { clearAllOfflineData } from "~/lib/offline-db";
import { resetTimestampCache } from "~/lib/sync-manager";
import { getConsoleBuffer } from "~/lib/console-buffer";
import { registerFcmToken, unregisterFcmToken } from "~/lib/firebase";
import { Switch } from "~/components/ui/switch";

export default function More() {
  const userIsAdmin = isAdmin();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  async function handleToggleNotifications(checked: boolean) {
    if (checked) {
      if (!("Notification" in window)) {
        toast.error("الإشعارات غير مدعومة في هذا المتصفح");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        try {
          await registerFcmToken();
          toast.success("تم تفعيل الإشعارات");
        } catch {
          toast.error("فشل تسجيل الجهاز للإشعارات");
        }
      } else {
        toast.error("تم رفض الإذن بالإشعارات");
      }
    } else {
      setNotificationsEnabled(false);
      try {
        await unregisterFcmToken();
      } catch {
        // Best-effort
      }
      toast.success("تم إيقاف الإشعارات");
    }
  }

  async function handleClearData() {
    const keysToRemove = ["authToken", "userRoles", "vite-ui-theme", "sidebar_state"];
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("attendance_pending_")) {
        localStorage.removeItem(k);
      }
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
      {userIsAdmin && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">إدارة</h2>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/admin/accounts">
              <ShieldCheck className="size-4" />
              إدارة الحسابات
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/admin/classes">
              <School className="size-4" />
              إدارة الخدمات والفصول
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/admin/events">
              <CalendarDays className="size-4" />
              إدارة الغياب
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/admin/districts">
              <MapPin className="size-4" />
              إدارة المناطق
            </Link>
          </Button>
        </div>
      )}
      <ModeToggle />
      <Logout />

      <hr className="border-t border-border" />

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="justify-start">
            <Settings className="size-4" />
            الإعدادات
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="flex flex-col gap-3 pb-8">
          <SheetHeader>
            <SheetTitle>الإعدادات</SheetTitle>
          </SheetHeader>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">الإشعارات</p>
                <p className="text-xs text-muted-foreground">استلام إشعارات فورية</p>
              </div>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleToggleNotifications}
            />
          </div>

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
        </SheetContent>
      </Sheet>
    </div>
  );
}
