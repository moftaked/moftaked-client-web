import { useState, useMemo, useEffect } from "react";
import { useRevalidator, Link, useLocation } from "react-router";
import { useSearchFilter } from "~/contexts/search-context";
import { useRouteState } from "~/contexts/route-state-context";
import api from "~/lib/api";
import type { Route } from "./+types/class";
import {
  fetchAndCache,
  resetTimestampCache,
  registerFetcher,
  unregisterFetcher,
} from "~/lib/sync-manager";
import { Skeleton } from "~/components/ui/skeleton";
import { cn, isManager } from "~/lib/utils";
import { classStudentsKey, classTeachersKey, DISTRICTS_KEY, removeCached } from "~/lib/offline-db";
import { PersonAvatar } from "~/components/person-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2, Loader2, Columns3, ClipboardCopy, Check, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Column Definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: string;
  label: string;
}

const DATA_COLUMNS: ColumnDef[] = [
  { key: "index", label: "#" },
  { key: "name", label: "الاسم" },
  { key: "district", label: "المنطقة" },
  { key: "address", label: "العنوان" },
  { key: "phone_numbers", label: "أرقام التليفون" },
  { key: "notes", label: "ملاحظات" },
];

const ALL_COLUMN_KEYS = DATA_COLUMNS.map((c) => c.key);

function getColumnValue(
  type: "student" | "teacher",
  person: Student | Teacher,
  key: string,
  index: number
): string {
  switch (key) {
    case "index":
      return String(index + 1);
    case "name":
      return type === "student"
        ? (person as Student).student_name
        : (person as Teacher).teacher_name;
    case "district":
      return person.district ?? "";
    case "address":
      return person.address ?? "";
    case "phone_numbers":
      return person.phone_numbers ?? "";
    case "notes":
      return person.notes ?? "";
    default:
      return "";
  }
}

function buildRows(
  type: "student" | "teacher",
  persons: (Student | Teacher)[],
  selectedKeys: string[]
): string[][] {
  return persons.map((person, i) =>
    selectedKeys.map((key) => getColumnValue(type, person, key, i))
  );
}

function toClipboardText(headers: string[], rows: string[][]): string {
  const lines = [headers.join("\t"), ...rows.map((r) => r.join("\t"))];
  return lines.join("\n");
}

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  // BOM for Excel Arabic support
  return "\uFEFF" + lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Student {
  student_id: number;
  student_name: string;
  address: string | null;
  photo_link: string | null;
  phone_numbers: string | null;
  district: string | null;
  notes: string | null;
}

interface Teacher {
  teacher_id: number;
  teacher_name: string;
  address: string | null;
  photo_link: string | null;
  phone_numbers: string | null;
  district: string | null;
  notes: string | null;
}

interface District {
  district_id: number;
  district_name: string;
}

interface PersonFormData {
  name: string;
  address: string;
  phone_number: string;
  second_phone_number: string;
  district_id: number | "";
  notes: string;
}

type SheetState =
  | { open: false }
  | { open: true; mode: "add"; type: "student" | "teacher" }
  | { open: true; mode: "edit"; type: "student"; person: Student }
  | { open: true; mode: "edit"; type: "teacher"; person: Teacher };

const emptyForm: PersonFormData = {
  name: "",
  address: "",
  phone_number: "",
  second_phone_number: "",
  district_id: "",
  notes: "",
};

function personToFormData(
  person: Student | Teacher,
  districts: District[]
): PersonFormData {
  const name = "student_name" in person ? person.student_name : person.teacher_name;
  const phones = person.phone_numbers ? person.phone_numbers.split(", ") : [];
  const matchedDistrict = districts.find((d) => d.district_name === person.district);

  return {
    name: name ?? "",
    address: person.address ?? "",
    phone_number: phones[0] ?? "",
    second_phone_number: phones[1] ?? "",
    district_id: matchedDistrict?.district_id ?? "",
    notes: person.notes ?? "",
  };
}

function getPersonId(type: "student" | "teacher", person: Student | Teacher): number {
  return type === "student"
    ? (person as Student).student_id
    : (person as Teacher).teacher_id;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const classId = params.classId;

  const [students, teachers, districts] = await Promise.all([
    fetchAndCache<Student[]>(
      classStudentsKey(classId),
      async () => {
        const res = await api.get<{ success: boolean; data: Student[] }>(`/classes/${classId}/students`);
        return res.data.data;
      }
    ),
    fetchAndCache<Teacher[] | null>(
      classTeachersKey(classId),
      async () => {
        try {
          const res = await api.get<{ success: boolean; data: Teacher[] }>(`/classes/${classId}/teachers`);
          return res.data.data;
        } catch {
          return null;
        }
      }
    ),
    fetchAndCache<District[]>(
      DISTRICTS_KEY,
      async () => {
        const res = await api.get<{ success: boolean; data: District[] }>("/districts");
        return res.data.data;
      }
    ),
  ]);

  return {
    classId,
    students,
    teachers,
    districts,
  };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  onAdd,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  const Icon = expanded ? ChevronUp : ChevronDown;

  return (
    <section>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          className="grow justify-between text-xl font-bold px-2 py-5"
          onClick={onToggle}
        >
          <span>
            {title} ({count})
          </span>
          <Icon className="size-5" />
        </Button>
        {onAdd && (
          <Button variant="outline" size="icon" onClick={onAdd}>
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      {expanded && <div className="mt-2">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Person Form Sheet
// ---------------------------------------------------------------------------

function PersonFormSheet({
  sheetState,
  districts,
  classId,
  onClose,
  onSuccess,
}: {
  sheetState: SheetState;
  districts: District[];
  classId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isOpen = sheetState.open;
  const mode = isOpen ? sheetState.mode : "add";
  const type = isOpen ? sheetState.type : "student";

  const initialForm =
    isOpen && sheetState.mode === "edit"
      ? personToFormData(sheetState.person, districts)
      : emptyForm;

  const [form, setForm] = useState<PersonFormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Add district
  const [showAddDistrict, setShowAddDistrict] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState("");
  const [addingDistrict, setAddingDistrict] = useState(false);
  const revalidator = useRevalidator();

  async function handleAddDistrict() {
    const name = newDistrictName.trim();
    if (!name || name.length < 2) return;
    setAddingDistrict(true);
    try {
      await api.post("/districts", { name });
      setNewDistrictName("");
      setShowAddDistrict(false);
      resetTimestampCache();
      await removeCached(DISTRICTS_KEY);
      revalidator.revalidate();
    } catch {
      // silently fail
    } finally {
      setAddingDistrict(false);
    }
  }

  // Reset form when sheet state changes
  const [prevState, setPrevState] = useState(sheetState);
  if (sheetState !== prevState) {
    setPrevState(sheetState);
    if (sheetState.open) {
      const newForm =
        sheetState.mode === "edit"
          ? personToFormData(sheetState.person, districts)
          : emptyForm;
      setForm(newForm);
      setErrors({});
      setApiError(null);
      setSubmitting(false);
      setDeleting(false);
    }
  }

  function updateField<K extends keyof PersonFormData>(key: K, value: PersonFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof PersonFormData, string>> = {};

    if (!form.name.trim() || form.name.trim().length < 2) {
      newErrors.name = "الاسم مطلوب (حرفين على الأقل)";
    }
    if (!form.address.trim() || form.address.trim().length < 4) {
      newErrors.address = "العنوان مطلوب (4 حروف على الأقل)";
    }
    if (!form.phone_number.trim() || !/^[0-9]{7,15}$/.test(form.phone_number.trim())) {
      newErrors.phone_number = "رقم تليفون صحيح مطلوب (7-15 رقم)";
    }
    if (
      form.second_phone_number.trim() &&
      !/^[0-9]{7,15}$/.test(form.second_phone_number.trim())
    ) {
      newErrors.second_phone_number = "رقم التليفون الثاني غير صحيح";
    }
    if (form.district_id === "") {
      newErrors.district_id = "المنطقة مطلوبة";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setSubmitting(true);
    setApiError(null);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim(),
      phone_number: form.phone_number.trim(),
      district_id: form.district_id,
    };

    if (form.second_phone_number.trim()) {
      payload.second_phone_number = form.second_phone_number.trim();
    }
    if (form.notes.trim()) {
      payload.notes = form.notes.trim();
    }

    try {
      if (mode === "add") {
        payload.class_id = parseInt(classId);
        await api.post(`/persons/${type === "student" ? "students" : "teachers"}`, payload);
      } else if (isOpen && sheetState.mode === "edit") {
        const personId = getPersonId(type, sheetState.person);
        const paramKey = type === "student" ? "students" : "teachers";
        await api.put(`/persons/${paramKey}/${personId}`, payload);
      }
      onSuccess();
      onClose();
    } catch {
      setApiError("حصلت مشكلة، حاول تاني");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isOpen || sheetState.mode !== "edit") return;

    const personId = getPersonId(type, sheetState.person);

    setDeleting(true);
    setApiError(null);

    try {
      const paramKey = type === "student" ? "students" : "teachers";
      await api.delete(`/classes/${classId}/${paramKey}/${personId}`);
      onSuccess();
      onClose();
    } catch {
      setApiError("حصلت مشكلة في الحذف، حاول تاني");
    } finally {
      setDeleting(false);
    }
  }

  const typeLabel = type === "student" ? "مخدوم" : "خادم";
  const sheetTitle = mode === "add" ? `إضافة ${typeLabel}` : `تعديل ${typeLabel}`;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>
            {mode === "add"
              ? `اكتب بيانات ال${typeLabel} الجديد`
              : `عدّل بيانات ال${typeLabel}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {/* Name */}
          <FormField label="الاسم" error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="اسم المخدوم"
            />
          </FormField>

          {/* Address */}
          <FormField label="العنوان" error={errors.address}>
            <Input
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="العنوان"
            />
          </FormField>

          {/* Phone Number */}
          <FormField label="رقم التليفون" error={errors.phone_number}>
            <Input
              dir="ltr"
              className="text-right"
              type="tel"
              inputMode="numeric"
              value={form.phone_number}
              onChange={(e) => updateField("phone_number", e.target.value.replace(/\D/g, ""))}
              placeholder="01xxxxxxxxx"
            />
          </FormField>

          {/* Second Phone Number */}
          <FormField label="رقم تليفون ثاني (اختياري)" error={errors.second_phone_number}>
            <Input
              dir="ltr"
              className="text-right"
              type="tel"
              inputMode="numeric"
              value={form.second_phone_number}
              onChange={(e) =>
                updateField("second_phone_number", e.target.value.replace(/\D/g, ""))
              }
              placeholder="01xxxxxxxxx"
            />
          </FormField>

          {/* District */}
          <FormField label="المنطقة" error={errors.district_id}>
            <div className="flex gap-2">
              <select
                value={form.district_id}
                onChange={(e) =>
                  updateField("district_id", e.target.value ? parseInt(e.target.value) : "")
                }
                className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-primary border-primary h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-lg font-light shadow-lg transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="">اختر المنطقة</option>
                {districts.map((d) => (
                  <option key={d.district_id} value={d.district_id}>
                    {d.district_name}
                  </option>
                ))}
              </select>
              {isManager() && (
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setShowAddDistrict(true)}
                >
                  <Plus className="size-4" />
                </Button>
              )}
            </div>
            {showAddDistrict && (
              <div className="flex gap-2 mt-2">
                <Input
                  value={newDistrictName}
                  onChange={(e) => setNewDistrictName(e.target.value)}
                  placeholder="اسم المنطقة الجديدة"
                  className="grow"
                />
                <Button
                  size="sm"
                  onClick={handleAddDistrict}
                  disabled={addingDistrict || newDistrictName.trim().length < 2}
                >
                  {addingDistrict ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "إضافة"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddDistrict(false);
                    setNewDistrictName("");
                  }}
                >
                  إلغاء
                </Button>
              </div>
            )}
          </FormField>

          {/* Notes */}
          <FormField label="ملاحظات (اختياري)" error={errors.notes}>
            <textarea
              dir="auto"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="ملاحظات"
              rows={3}
              className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-primary border-primary w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-lg font-light shadow-lg transition-[color,box-shadow] outline-none resize-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </FormField>

          {apiError && (
            <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md text-sm text-center">
              {apiError}
            </div>
          )}
        </div>

        <SheetFooter>
          <div className="flex flex-col gap-2 w-full">
            <Button onClick={handleSubmit} disabled={submitting || deleting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : mode === "add" ? (
                "إضافة"
              ) : (
                "حفظ التعديلات"
              )}
            </Button>

            {mode === "edit" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={submitting || deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        جاري الحذف...
                      </>
                    ) : (
                      <>
                        <Trash2 className="size-4" />
                        حذف من الفصل
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                    <AlertDialogDescription>
                      {"متأكد إنك عايز تحذف "}
                      {isOpen && sheetState.mode === "edit"
                        ? `"${type === "student" ? (sheetState.person as Student).student_name : (sheetState.person as Teacher).teacher_name}"`
                        : ""}
                      {" من الفصل؟"}
                      <div className="mt-3 p-3 bg-destructive/15 text-destructive rounded-md text-sm font-medium">
                        ملاحظة: إذا كان هذا هو الفصل الوحيد للشخص، سيتم حذفه نهائياً بعد الإزالة.
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>لأ</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDelete}>
                      أيوه، احذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Form Field Wrapper
// ---------------------------------------------------------------------------

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Toolbar (column picker, copy, export)
// ---------------------------------------------------------------------------

function DataToolbar({
  type,
  persons,
  selectedColumns,
  onToggleColumn,
}: {
  type: "student" | "teacher";
  persons: (Student | Teacher)[];
  selectedColumns: Set<string>;
  onToggleColumn: (key: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const selectedKeys = ALL_COLUMN_KEYS.filter((k) => selectedColumns.has(k));
  const selectedHeaders = DATA_COLUMNS.filter((c) => selectedColumns.has(c.key)).map((c) => c.label);

  function handleCopy() {
    const rows = buildRows(type, persons, selectedKeys);
    const text = toClipboardText(selectedHeaders, rows);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleExportCsv() {
    const rows = buildRows(type, persons, selectedKeys);
    const csv = toCsv(selectedHeaders, rows);
    const label = type === "student" ? "students" : "teachers";
    downloadCsv(`${label}.csv`, csv);
  }

  return (
    <div className="flex items-center gap-1 mb-2">
      {/* Column picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Columns3 className="size-3.5" />
            العواميد ({selectedColumns.size})
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-2">
          <div className="flex flex-col gap-1">
            {DATA_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selectedColumns.has(col.key)}
                  onChange={() => onToggleColumn(col.key)}
                  className="accent-primary size-4"
                />
                {col.label}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Copy to clipboard */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={selectedColumns.size === 0}
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="size-3.5" />
            تم النسخ
          </>
        ) : (
          <>
            <ClipboardCopy className="size-3.5" />
            كوبي
          </>
        )}
      </Button>

      {/* Export CSV */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={selectedColumns.size === 0}
        onClick={handleExportCsv}
      >
        <Download className="size-3.5" />
        تحميل
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Person Table
// ---------------------------------------------------------------------------

type SortDirection = "asc" | "desc";

interface SortState {
  column: string | null;
  direction: SortDirection;
}

function getSortValue(
  type: "student" | "teacher",
  person: Student | Teacher,
  key: string
): string {
  switch (key) {
    case "name":
      return type === "student"
        ? (person as Student).student_name
        : (person as Teacher).teacher_name;
    case "district":
      return person.district ?? "";
    case "address":
      return person.address ?? "";
    case "phone_numbers":
      return person.phone_numbers ?? "";
    case "notes":
      return person.notes ?? "";
    default:
      return "";
  }
}

const SORTABLE_COLUMNS = new Set(["name", "district", "address", "phone_numbers", "notes"]);

function SortIcon({ column, sort }: { column: string; sort: SortState }) {
  if (sort.column !== column) {
    return <ArrowUpDown className="size-3 opacity-40" />;
  }
  return sort.direction === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

function SortableHead({
  column,
  label,
  sort,
  onSort,
  frozen,
  className,
}: {
  column: string;
  label: string;
  sort: SortState;
  onSort: (column: string) => void;
  frozen?: boolean;
  className?: string;
}) {
  return (
    <TableHead
      frozen={frozen}
      className={cn("cursor-pointer select-none", className)}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon column={column} sort={sort} />
      </span>
    </TableHead>
  );
}

function PersonTable<T extends Student | Teacher>({
  type,
  persons,
  selectedColumns,
  sort,
  onToggleColumn,
  onSort,
  onEdit,
  avatarVersion,
}: {
  type: "student" | "teacher";
  persons: T[];
  selectedColumns: Set<string>;
  sort: SortState;
  onToggleColumn: (key: string) => void;
  onSort: (column: string) => void;
  onEdit: (person: T) => void;
  avatarVersion: number;
}) {
  const showIndex = selectedColumns.has("index");
  const showName = selectedColumns.has("name");
  const nameStartClass = showIndex ? "start-10" : "start-0";

  const sortedPersons = useMemo(() => {
    if (!sort.column) return persons;
    const col = sort.column;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...persons].sort((a, b) => {
      const aVal = getSortValue(type, a, col);
      const bVal = getSortValue(type, b, col);
      if (!aVal && bVal) return 1;
      if (aVal && !bVal) return -1;
      return dir * aVal.localeCompare(bVal, "ar");
    });
  }, [persons, sort, type]);

  return (
    <div>
      <DataToolbar
        type={type}
        persons={persons}
        selectedColumns={selectedColumns}
        onToggleColumn={onToggleColumn}
      />
      <Table>
        <TableHeader>
          <TableRow>
            {showIndex && (
              <TableHead frozen className="start-0 w-10 min-w-10 max-w-10 text-center px-0">
                #
              </TableHead>
            )}
            {showName && (
              <SortableHead
                column="name"
                label="الاسم"
                sort={sort}
                onSort={onSort}
                frozen
                className={`${nameStartClass} whitespace-normal`}
              />
            )}
            {selectedColumns.has("district") && (
              <SortableHead column="district" label="المنطقة" sort={sort} onSort={onSort} />
            )}
            {selectedColumns.has("address") && (
              <SortableHead column="address" label="العنوان" sort={sort} onSort={onSort} />
            )}
            {selectedColumns.has("phone_numbers") && (
              <SortableHead column="phone_numbers" label="أرقام التليفون" sort={sort} onSort={onSort} />
            )}
            {selectedColumns.has("notes") && (
              <SortableHead column="notes" label="ملاحظات" sort={sort} onSort={onSort} />
            )}
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPersons.map((person, index) => {
            const name =
              type === "student"
                ? (person as Student).student_name
                : (person as Teacher).teacher_name;

            const personId =
              type === "student"
                ? (person as Student).student_id
                : (person as Teacher).teacher_id;

            const photoLink = person.photo_link;

            return (
              <TableRow
                key={personId}
              >
                {showIndex && (
                  <TableCell frozen className="start-0 w-10 min-w-10 max-w-10 text-center px-0">
                    {index + 1}
                  </TableCell>
                )}
                {showName && (
                  <TableCell frozen className={`${nameStartClass} font-medium min-w-0 w-28 max-w-28 whitespace-normal`}>
                    <Link
                      to={`/person/${type}/${personId}`}
                      className="flex items-center gap-2 hover:text-primary transition-colors"
                    >
                      <PersonAvatar
                        photoLink={photoLink}
                        name={name}
                        size="sm"
                        clickToView={false}
                        version={avatarVersion}
                      />
                      <span className="break-words">{name}</span>
                    </Link>
                  </TableCell>
                )}
                {selectedColumns.has("district") && (
                  <TableCell>{person.district ?? "—"}</TableCell>
                )}
                {selectedColumns.has("address") && (
                  <TableCell>{person.address ?? "—"}</TableCell>
                )}
                {selectedColumns.has("phone_numbers") && (
                  <TableCell dir="ltr" className="text-right">
                    {person.phone_numbers ?? "—"}
                  </TableCell>
                )}
                {selectedColumns.has("notes") && (
                  <TableCell>{person.notes ?? "—"}</TableCell>
                )}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onEdit(person)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Class({ loaderData }: Route.ComponentProps) {
  const { classId, students, teachers, districts } = loaderData;
  const revalidator = useRevalidator();
  const filterText = useSearchFilter();
  const [avatarVersion, setAvatarVersion] = useState(1);
  const location = useLocation();
  const { saveState, restoreState } = useRouteState();

  // Register fetchers so backgroundSync can re-fetch when data changes
  useEffect(() => {
    const sk = classStudentsKey(classId);
    const tk = classTeachersKey(classId);
    registerFetcher(sk, async () => {
      const res = await api.get<{ success: boolean; data: Student[] }>(`/classes/${classId}/students`);
      return res.data.data;
    });
    registerFetcher(tk, async () => {
      const res = await api.get<{ success: boolean; data: Teacher[] }>(`/classes/${classId}/teachers`);
      return res.data.data;
    });
    return () => {
      unregisterFetcher(sk);
      unregisterFetcher(tk);
    };
  }, [classId]);

  const savedState = restoreState(location.pathname) ?? {};

  const defaultColumns = ALL_COLUMN_KEYS.filter(k => k !== "index");

  const [studentsExpanded, setStudentsExpanded] = useState(
    savedState.studentSectionExpanded ?? false
  );
  const [teachersExpanded, setTeachersExpanded] = useState(
    savedState.teacherSectionExpanded ?? false
  );

  const [studentColumns, setStudentColumns] = useState<Set<string>>(
    () => new Set(savedState.studentColumns ?? defaultColumns)
  );
  const [studentSort, setStudentSort] = useState<SortState>({
    column: savedState.studentSortColumn ?? null,
    direction: savedState.studentSortDirection ?? "asc",
  });

  const [teacherColumns, setTeacherColumns] = useState<Set<string>>(
    () => new Set(savedState.teacherColumns ?? defaultColumns)
  );
  const [teacherSort, setTeacherSort] = useState<SortState>({
    column: savedState.teacherSortColumn ?? null,
    direction: savedState.teacherSortDirection ?? "asc",
  });

  useEffect(() => {
    saveState(location.pathname, {
      studentSectionExpanded: studentsExpanded,
      teacherSectionExpanded: teachersExpanded,
      studentColumns: [...studentColumns],
      studentSortColumn: studentSort.column,
      studentSortDirection: studentSort.direction,
      teacherColumns: [...teacherColumns],
      teacherSortColumn: teacherSort.column,
      teacherSortDirection: teacherSort.direction,
    });
  }, [studentsExpanded, teachersExpanded, studentColumns, studentSort, teacherColumns, teacherSort, saveState, location.pathname]);

  function toggleStudentColumn(key: string) {
    setStudentColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleStudentSort(column: string) {
    setStudentSort((prev) => {
      if (prev.column === column) {
        if (prev.direction === "asc") return { column, direction: "desc" };
        return { column: null, direction: "asc" };
      }
      return { column, direction: "asc" };
    });
  }

  function toggleTeacherColumn(key: string) {
    setTeacherColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleTeacherSort(column: string) {
    setTeacherSort((prev) => {
      if (prev.column === column) {
        if (prev.direction === "asc") return { column, direction: "desc" };
        return { column: null, direction: "asc" };
      }
      return { column, direction: "asc" };
    });
  }

  const filteredStudents = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.student_name.toLowerCase().includes(q));
  }, [students, filterText]);

  const filteredTeachers = useMemo(() => {
    if (!teachers) return null;
    const q = filterText.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => t.teacher_name.toLowerCase().includes(q));
  }, [teachers, filterText]);

  const [sheetState, setSheetState] = useState<SheetState>({ open: false });

  function openAdd(type: "student" | "teacher") {
    setSheetState({ open: true, mode: "add", type });
  }

  function openEditStudent(person: Student) {
    setSheetState({ open: true, mode: "edit", type: "student", person });
  }

  function openEditTeacher(person: Teacher) {
    setSheetState({ open: true, mode: "edit", type: "teacher", person });
  }

  function closeSheet() {
    setSheetState({ open: false });
  }

  async function handleSuccess() {
    // Bump version to bust browser cache for avatar images
    setAvatarVersion((v) => v + 1);
    // Invalidate cached data so revalidation fetches fresh from API
    resetTimestampCache();
    await Promise.all([
      removeCached(classStudentsKey(classId)),
      removeCached(classTeachersKey(classId)),
    ]);
    revalidator.revalidate();
  }

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection
        title="المخدومين"
        count={filteredStudents.length}
        expanded={studentsExpanded}
        onToggle={() => setStudentsExpanded((v) => !v)}
        onAdd={() => openAdd("student")}
      >
        {filteredStudents.length === 0 ? (
          <p className="text-muted-foreground">
            {filterText.trim() ? "لا يوجد نتائج" : "لا يوجد مخدومين في هذا الفصل"}
          </p>
        ) : (
          <PersonTable type="student" persons={filteredStudents} selectedColumns={studentColumns} sort={studentSort} onToggleColumn={toggleStudentColumn} onSort={handleStudentSort} onEdit={openEditStudent} avatarVersion={avatarVersion} />
        )}
      </CollapsibleSection>

      {filteredTeachers !== null && (
        <CollapsibleSection
          title="الخدام"
          count={filteredTeachers.length}
          expanded={teachersExpanded}
          onToggle={() => setTeachersExpanded((v) => !v)}
          onAdd={() => openAdd("teacher")}
        >
          {filteredTeachers.length === 0 ? (
            <p className="text-muted-foreground">
              {filterText.trim() ? "لا يوجد نتائج" : "لا يوجد خدام في هذا الفصل"}
            </p>
          ) : (
            <PersonTable type="teacher" persons={filteredTeachers} selectedColumns={teacherColumns} sort={teacherSort} onToggleColumn={toggleTeacherColumn} onSort={handleTeacherSort} onEdit={openEditTeacher} avatarVersion={avatarVersion} />
          )}
        </CollapsibleSection>
      )}

      <PersonFormSheet
        sheetState={sheetState}
        districts={districts}
        classId={classId}
        onClose={closeSheet}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
