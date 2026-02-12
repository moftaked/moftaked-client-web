import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/admin-persons";
import { isManager, getPhotoUrl } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  ArrowRight,
  Search,
  Loader2,
  UserPlus,
  ArrowLeftRight,
  Trash2,
  GraduationCap,
  Users,
  User,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonSearchResult {
  person_id: number;
  person_name: string;
  photo_link: string | null;
  classIds: string; // comma-separated
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

type SheetState =
  | { type: "closed" }
  | { type: "assign"; person: PersonSearchResult; personType: "student" | "teacher" };

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader() {
  if (!isManager()) {
    throw new Response("Forbidden", { status: 403 });
  }

  const classesRes = await api.get<{ success: boolean; data: ClassInfo[] }>(
    "/accounts/classes",
  );

  return {
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

export default function AdminPersons({ loaderData }: Route.ComponentProps) {
  const { classes } = loaderData;

  const [searchType, setSearchType] = useState<"student" | "teacher">("student");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [sheetState, setSheetState] = useState<SheetState>({ type: "closed" });

  // Group classes by school for the select dropdown
  const schoolMap = useMemo(() => {
    const map = new Map<string, ClassInfo[]>();
    for (const cls of classes) {
      const key = cls.school_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cls);
    }
    return map;
  }, [classes]);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      toast.error("اكتب حرفين على الأقل للبحث");
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      const paramKey = searchType === "student" ? "students" : "teachers";
      const res = await api.get<PersonSearchResult[]>(
        `/persons/${paramKey}`,
        { params: { name: q } },
      );
      setSearchResults(res.data);
    } catch {
      toast.error("حصلت مشكلة في البحث");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSearch();
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
        <h1 className="text-xl font-bold flex-1">نقل و تعيين الأشخاص</h1>
      </div>

      {/* Search section */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button
              variant={searchType === "student" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSearchType("student");
                setSearchResults([]);
                setHasSearched(false);
              }}
            >
              <GraduationCap className="size-4" />
              مخدومين
            </Button>
            <Button
              variant={searchType === "teacher" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSearchType("teacher");
                setSearchResults([]);
                setHasSearched(false);
              }}
            >
              <Users className="size-4" />
              خدام
            </Button>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <Input
              placeholder={`بحث عن ${searchType === "student" ? "مخدوم" : "خادم"} بالاسم...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching} size="default">
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search results */}
      {hasSearched && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {searching
              ? "جاري البحث..."
              : `النتائج (${searchResults.length})`}
          </h2>

          {!searching && searchResults.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              لا يوجد نتائج
            </p>
          )}

          {!searching &&
            searchResults.map((person) => (
              <PersonResultCard
                key={person.person_id}
                person={person}
                personType={searchType}
                classes={classes}
                onAssign={() =>
                  setSheetState({
                    type: "assign",
                    person,
                    personType: searchType,
                  })
                }
              />
            ))}
        </div>
      )}

      {/* Assign Sheet */}
      {sheetState.type === "assign" && (
        <AssignPersonSheet
          open
          person={sheetState.person}
          personType={sheetState.personType}
          classes={classes}
          schoolMap={schoolMap}
          onClose={() => setSheetState({ type: "closed" })}
          onSuccess={() => {
            // Re-search to refresh results
            handleSearch();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Person Result Card
// ---------------------------------------------------------------------------

function PersonResultCard({
  person,
  personType,
  classes,
  onAssign,
}: {
  person: PersonSearchResult;
  personType: "student" | "teacher";
  classes: ClassInfo[];
  onAssign: () => void;
}) {
  const classIds = person.classIds
    ? person.classIds.split(", ").map((id) => parseInt(id.trim(), 10))
    : [];

  const classNames = classIds
    .map((id) => {
      const cls = classes.find((c) => c.class_id === id);
      return cls ? cls.class_name : `#${id}`;
    })
    .filter(Boolean);

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          {getPhotoUrl(person.photo_link, "md") ? (
            <img
              src={getPhotoUrl(person.photo_link, "md")!}
              alt={person.person_name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <User className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="font-semibold text-sm truncate">
            {person.person_name}
          </span>
          <div className="flex flex-wrap gap-1">
            {classNames.length > 0 ? (
              classNames.map((name, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">لا يوجد فصول</span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onAssign}>
          <ArrowLeftRight className="size-4" />
          تعيين
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Assign Person Sheet
// ---------------------------------------------------------------------------

function AssignPersonSheet({
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

  // Load person details to see current class assignments
  const [personClasses, setPersonClasses] = useState<PersonClass[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Load person's current classes on mount
  useEffect(() => {
    loadPersonClasses();
  }, []);

  async function loadPersonClasses() {
    setLoadingDetails(true);
    try {
      // Try loading as student first, then teacher
      const paramKey = personType === "student" ? "students" : "teachers";
      const res = await api.get<{ success: boolean; data: PersonDetail }>(
        `/persons/${paramKey}/${person.person_id}`,
      );
      setPersonClasses(res.data.data.classes || []);
    } catch {
      // If we can't load details, show empty
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
      // Refresh person classes
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
          {/* Current assignments */}
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

          {/* Add to new class */}
          <div className="border-t pt-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">تعيين في فصل جديد</h3>

            {/* Class select */}
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

            {/* Type select */}
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