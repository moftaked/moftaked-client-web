import { useState, useEffect } from "react";
import api from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  ArrowLeftRight,
  Loader2,
  UserPlus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface PersonSearchResult {
  person_id: number;
  person_name: string;
  photo_link: string | null;
  classIds?: string;
}

interface ClassInfo {
  class_id: number;
  class_name: string;
  school_id: number;
  school_name: string;
}

interface PersonClass {
  class_id: number;
  class_name: string;
  school_name: string;
  type: "student" | "teacher";
}

interface PersonDetail {
  person_id: number;
  person_name: string;
  address: string | null;
  photo_link: string | null;
  notes: string | null;
  district_name: string | null;
  phone_numbers: string | null;
  type: "student" | "teacher";
  classes: PersonClass[];
}

export function AssignPersonSheet({
  open,
  person,
  personType,
  classes,
  schoolMap,
  onClose,
  onSuccess,
}: {
  open: boolean;
  person: PersonSearchResult;
  personType: "student" | "teacher";
  classes: ClassInfo[];
  schoolMap: Map<string, ClassInfo[]>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");
  const [assignType, setAssignType] = useState<"student" | "teacher">(personType);
  const [submitting, setSubmitting] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [personClasses, setPersonClasses] = useState<PersonClass[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    if (open) loadPersonClasses();
  }, [open]);

  async function loadPersonClasses() {
    setLoadingDetails(true);
    try {
      const paramKey = personType === "student" ? "students" : "teachers";
      const res = await api.get<{ success: boolean; data: PersonDetail }>(
        `/persons/${paramKey}/${person.person_id}`,
      );
      setPersonClasses(res.data.data.classes || []);
    } catch {
      setPersonClasses([]);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleAssign() {
    if (!selectedClassId) {
      setApiError("اختر الفصل");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      await api.post("/accounts/assign-person", {
        person_id: person.person_id,
        class_id: selectedClassId,
        type: assignType,
      });
      toast.success("تم تعيين الشخص في الفصل بنجاح");
      setSelectedClassId("");
      onSuccess();
      await loadPersonClasses();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setApiError("الشخص معين بالفعل في هذا الفصل بنفس الدور");
      } else {
        setApiError("حصلت مشكلة، حاول تاني");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnassign(classId: number, type: "student" | "teacher") {
    const key = `${classId}-${type}`;
    setUnassigning(key);
    setApiError(null);

    try {
      await api.post("/accounts/unassign-person", {
        person_id: person.person_id,
        class_id: classId,
        type,
      });
      toast.success("تم إزالة الشخص من الفصل");
      onSuccess();
      await loadPersonClasses();
    } catch {
      setApiError("حصلت مشكلة في الإزالة");
    } finally {
      setUnassigning(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <ArrowLeftRight className="size-5 inline-block ml-2" />
            تعيين {person.person_name}
          </SheetTitle>
          <SheetDescription>
            تعيين أو إزالة الشخص من الفصول
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">الفصول الحالية</h3>

            {loadingDetails ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm text-muted-foreground">جاري التحميل...</span>
              </div>
            ) : personClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                الشخص غير معين في أي فصل
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفصل</TableHead>
                    <TableHead>الكنيسة</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personClasses.map((pc) => {
                    const key = `${pc.class_id}-${pc.type}`;
                    return (
                      <TableRow key={key}>
                        <TableCell className="text-sm font-medium">
                          {pc.class_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {pc.school_name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={pc.type === "teacher" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {pc.type === "student" ? "مخدوم" : "خادم"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                disabled={unassigning === key}
                              >
                                {unassigning === key ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الإزالة</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من إزالة{" "}
                                  <strong>{person.person_name}</strong> من فصل{" "}
                                  <strong>{pc.class_name}</strong>؟
                                  {personClasses.length === 1 && (
                                    <div className="mt-3 p-3 bg-destructive/15 text-destructive rounded-md text-sm font-medium">
                                      هذا هو الفصل الوحيد المرتبط بهذا الشخص. بعد إزالته، سيتم حذف الشخص نهائياً.
                                    </div>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>لأ</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => handleUnassign(pc.class_id, pc.type)}
                                >
                                  أيوه، أزل
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="border-t pt-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">تعيين في فصل جديد</h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">الفصل</label>
              <select
                value={selectedClassId}
                onChange={(e) =>
                  setSelectedClassId(e.target.value ? parseInt(e.target.value) : "")
                }
                className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-primary border-primary h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-lg transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="">اختر الفصل</option>
                {Array.from(schoolMap.entries()).map(([schoolName, schoolClasses]) => (
                  <optgroup key={schoolName} label={schoolName}>
                    {schoolClasses.map((cls) => (
                      <option key={cls.class_id} value={cls.class_id}>
                        {cls.class_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">النوع</label>
              <select
                value={assignType}
                onChange={(e) => setAssignType(e.target.value as "student" | "teacher")}
                className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-primary border-primary h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-lg transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="student">مخدوم</option>
                <option value="teacher">خادم</option>
              </select>
            </div>

            {apiError && (
              <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md text-sm text-center">
                {apiError}
              </div>
            )}

            <Button onClick={handleAssign} disabled={submitting} size="sm">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري التعيين...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  تعيين في الفصل
                </>
              )}
            </Button>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" className="w-full" onClick={onClose}>
            إغلاق
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
