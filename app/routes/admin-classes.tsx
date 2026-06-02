import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/admin-classes";
import { isManager } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  Pencil,
  Trash2,
  School,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SchoolInfo {
  school_id: number;
  school_name: string;
}

interface ClassInfo {
  class_id: number;
  class_name: string;
  school_id: number;
  school_name: string;
}

type SheetMode =
  | { type: "closed" }
  | { type: "create-school" }
  | { type: "edit-school"; school: SchoolInfo }
  | { type: "create-class"; school: SchoolInfo }
  | { type: "edit-class"; cls: ClassInfo };

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader() {
  if (!isManager()) {
    throw new Response("Forbidden", { status: 403 });
  }

  const [schoolsRes, classesRes] = await Promise.all([
    api.get<{ success: boolean; data: SchoolInfo[] }>("/classes/schools"),
    api.get<{ success: boolean; data: ClassInfo[] }>("/classes/all"),
  ]);

  return {
    schools: schoolsRes.data.data,
    classes: classesRes.data.data,
  };
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminClasses({ loaderData }: Route.ComponentProps) {
  const { schools: initialSchools, classes: initialClasses } = loaderData;

  const [schools, setSchools] = useState<SchoolInfo[]>(initialSchools);
  const [classes, setClasses] = useState<ClassInfo[]>(initialClasses);
  const [sheetMode, setSheetMode] = useState<SheetMode>({ type: "closed" });
  const [deletingSchoolId, setDeletingSchoolId] = useState<number | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<number | null>(null);

  async function refresh() {
    try {
      const [schoolsRes, classesRes] = await Promise.all([
        api.get<{ success: boolean; data: SchoolInfo[] }>("/classes/schools"),
        api.get<{ success: boolean; data: ClassInfo[] }>("/classes/all"),
      ]);
      setSchools(schoolsRes.data.data);
      setClasses(classesRes.data.data);
    } catch {
      // silent
    }
  }

  // Group classes by school
  const schoolClassMap = useMemo(() => {
    const map = new Map<number, ClassInfo[]>();
    for (const cls of classes) {
      if (!map.has(cls.school_id)) map.set(cls.school_id, []);
      map.get(cls.school_id)!.push(cls);
    }
    return map;
  }, [classes]);

  async function handleDeleteSchool(schoolId: number) {
    setDeletingSchoolId(schoolId);
    try {
      await api.delete(`/classes/schools/${schoolId}`);
      toast.success("تم حذف الخدمة");
      refresh();
    } catch {
      toast.error("حصلت مشكلة في حذف الخدمة");
    } finally {
      setDeletingSchoolId(null);
    }
  }

  async function handleDeleteClass(classId: number) {
    setDeletingClassId(classId);
    try {
      await api.delete(`/classes/${classId}/delete`);
      toast.success("تم حذف الفصل");
      refresh();
    } catch {
      toast.error("حصلت مشكلة في حذف الفصل");
    } finally {
      setDeletingClassId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-4" />
        </Link>
        <h1 className="text-xl font-bold flex-1">إدارة الخدمات والفصول</h1>
        <Button
          size="sm"
          onClick={() => setSheetMode({ type: "create-school" })}
        >
          <Plus className="size-4" />
          خدمة جديدة
        </Button>
      </div>

      {/* Schools list */}
      {schools.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          لا يوجد خدمات بعد
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {schools.map((school) => {
            const schoolClasses = schoolClassMap.get(school.school_id) ?? [];
            return (
              <Card key={school.school_id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <School className="size-5 text-muted-foreground shrink-0" />
                    <CardTitle className="flex-1 text-base">
                      {school.school_name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {schoolClasses.length} فصل
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        setSheetMode({ type: "edit-school", school })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Button>
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
                            حذف خدمة "{school.school_name}"؟
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتم حذف الخدمة وجميع الفصول والغياب والأدوار
                            المرتبطة بها. هذا الإجراء لا يمكن التراجع عنه.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() =>
                              handleDeleteSchool(school.school_id)
                            }
                            disabled={deletingSchoolId === school.school_id}
                          >
                            {deletingSchoolId === school.school_id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "حذف"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {schoolClasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      لا يوجد فصول في هذه الخدمة
                    </p>
                  ) : (
                    schoolClasses.map((cls) => (
                      <div
                        key={cls.class_id}
                        className="flex items-center gap-3 px-3 py-2 rounded-md border bg-muted/30"
                      >
                        <BookOpen className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate">
                          {cls.class_name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() =>
                            setSheetMode({ type: "edit-class", cls })
                          }
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                حذف فصل "{cls.class_name}"؟
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم حذف الفصل والغياب والأدوار
                                 المرتبطة به. هذا الإجراء لا يمكن
                                التراجع عنه.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() =>
                                  handleDeleteClass(cls.class_id)
                                }
                                disabled={deletingClassId === cls.class_id}
                              >
                                {deletingClassId === cls.class_id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  "حذف"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit mt-1"
                    onClick={() =>
                      setSheetMode({ type: "create-class", school })
                    }
                  >
                    <Plus className="size-4" />
                    إضافة فصل
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sheets */}
      <SchoolSheet
        mode={
          sheetMode.type === "create-school"
            ? "create"
            : sheetMode.type === "edit-school"
              ? "edit"
              : null
        }
        school={sheetMode.type === "edit-school" ? sheetMode.school : null}
        onClose={() => setSheetMode({ type: "closed" })}
        onSuccess={() => {
          setSheetMode({ type: "closed" });
          refresh();
        }}
      />

      <ClassSheet
        mode={
          sheetMode.type === "create-class"
            ? "create"
            : sheetMode.type === "edit-class"
              ? "edit"
              : null
        }
        school={sheetMode.type === "create-class" ? sheetMode.school : null}
        cls={sheetMode.type === "edit-class" ? sheetMode.cls : null}
        onClose={() => setSheetMode({ type: "closed" })}
        onSuccess={() => {
          setSheetMode({ type: "closed" });
          refresh();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// School Sheet (create / edit)
// ---------------------------------------------------------------------------

function SchoolSheet({
  mode,
  school,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit" | null;
  school: SchoolInfo | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const open = mode !== null;
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(mode === "edit" && school ? school.school_name : "");
      setSubmitting(false);
      setApiError(null);
    }
  }, [open, mode, school]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setApiError("اسم الخدمة يجب أن يكون حرفين على الأقل");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      if (mode === "create") {
        await api.post("/classes/schools", { school_name: trimmed });
        toast.success("تم إنشاء الخدمة");
      } else if (mode === "edit" && school) {
        await api.put(`/classes/schools/${school.school_id}`, {
          school_name: trimmed,
        });
        toast.success("تم تعديل الخدمة");
      }
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
            <School className="size-5 inline-block ml-2" />
            {mode === "create" ? "إنشاء خدمة جديدة" : "تعديل الخدمة"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "أدخل اسم الخدمة الجديدة"
              : "عدّل اسم الخدمة"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">اسم الخدمة</label>
            <Input
              placeholder="مثال: خدمة ابتدائي"
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
            ) : mode === "create" ? (
              "إنشاء الخدمة"
            ) : (
              "حفظ التعديل"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Class Sheet (create / edit)
// ---------------------------------------------------------------------------

function ClassSheet({
  mode,
  school,
  cls,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit" | null;
  school: SchoolInfo | null;
  cls: ClassInfo | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const open = mode !== null;
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(mode === "edit" && cls ? cls.class_name : "");
      setSubmitting(false);
      setApiError(null);
    }
  }, [open, mode, cls]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setApiError("اسم الفصل يجب أن يكون حرفين على الأقل");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      if (mode === "create" && school) {
        await api.post("/classes", {
          class_name: trimmed,
          school_id: school.school_id,
        });
        toast.success("تم إنشاء الفصل");
      } else if (mode === "edit" && cls) {
        await api.put(`/classes/${cls.class_id}`, {
          class_name: trimmed,
        });
        toast.success("تم تعديل الفصل");
      }
      onSuccess();
    } catch {
      setApiError("حصلت مشكلة، حاول تاني");
    } finally {
      setSubmitting(false);
    }
  }

  const contextLabel =
    mode === "create" && school
      ? `إضافة فصل في "${school.school_name}"`
      : mode === "edit" && cls
        ? `تعديل فصل "${cls.class_name}"`
        : "";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <BookOpen className="size-5 inline-block ml-2" />
            {mode === "create" ? "إنشاء فصل جديد" : "تعديل الفصل"}
          </SheetTitle>
          <SheetDescription>{contextLabel}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">اسم الفصل</label>
            <Input
              placeholder="مثال: حضانة"
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
            ) : mode === "create" ? (
              "إنشاء الفصل"
            ) : (
              "حفظ التعديل"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}