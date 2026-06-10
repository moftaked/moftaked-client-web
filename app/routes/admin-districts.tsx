import { useState, useEffect } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/admin-districts";
import { isManager } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
} from "~/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "~/components/ui/sheet";
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
  ArrowRight,
  Plus,
  Loader2,
  Trash2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

interface District {
  district_id: number;
  district_name: string;
}

export async function clientLoader() {
  if (!isManager()) {
    throw new Response("Forbidden", { status: 403 });
  }

  const res = await api.get<{ success: boolean; data: District[] }>("/districts");
  return { districts: res.data.data };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function AdminDistricts({ loaderData }: Route.ComponentProps) {
  const { districts: initialDistricts } = loaderData;
  const [districts, setDistricts] = useState<District[]>(initialDistricts);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function refresh() {
    try {
      const res = await api.get<{ success: boolean; data: District[] }>("/districts");
      setDistricts(res.data.data);
    } catch {
      // silent
    }
  }

  async function handleDelete(districtId: number) {
    setDeletingId(districtId);
    try {
      await api.delete(`/districts/${districtId}`);
      toast.success("تم حذف المنطقة");
      refresh();
    } catch {
      toast.error("حصلت مشكلة في حذف المنطقة");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-8">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-4" />
        </Link>
        <h1 className="text-xl font-bold flex-1">إدارة المناطق</h1>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="size-4" />
          منطقة جديدة
        </Button>
      </div>

      {districts.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          لا يوجد مناطق بعد
        </p>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            {districts.map((district) => (
              <div
                key={district.district_id}
                className="flex items-center gap-3 px-3 py-3 rounded-md border bg-muted/30"
              >
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">
                  {district.district_name}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        حذف منطقة "{district.district_name}"؟
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف المنطقة. هذا الإجراء لا يمكن التراجع عنه.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(district.district_id)}
                        disabled={deletingId === district.district_id}
                      >
                        {deletingId === district.district_id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "حذف"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CreateDistrictSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSuccess={() => {
          setSheetOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function CreateDistrictSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setSubmitting(false);
      setApiError(null);
    }
  }, [open]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setApiError("اسم المنطقة يجب أن يكون حرفين على الأقل");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      await api.post("/districts", { name: trimmed });
      toast.success("تم إنشاء المنطقة");
      onSuccess();
    } catch {
      setApiError("حصلت مشكلة، حاول تاني");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <MapPin className="size-5 inline-block ml-2" />
            إنشاء منطقة جديدة
          </SheetTitle>
          <SheetDescription>
            أدخل اسم المنطقة الجديدة
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">اسم المنطقة</label>
            <Input
              placeholder="مثال: الخليل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {apiError && (
            <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md text-sm text-center">
              {apiError}
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              "إنشاء المنطقة"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
