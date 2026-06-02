import { useState, useEffect } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/admin-accounts";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Plus,
  Loader2,
  UserPlus,
  ShieldCheck,
  ArrowRight,
  Copy,
  Check,
  Trash2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleInfo {
  role_id: number;
  role: string;
  class_id: number;
  class_name: string;
  school_name: string;
}

interface Account {
  account_id: number;
  username: string;
  real_name: string;
  roles: RoleInfo[];
}

interface ClassInfo {
  class_id: number;
  class_name: string;
  school_id: number;
  school_name: string;
}

interface CreatedAccount {
  userId: number;
  password: string;
}

type SheetMode =
  | { type: "closed" }
  | { type: "create-account" }
  | { type: "assign-role"; account: Account };

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader() {
  if (!isManager()) {
    throw new Response("Forbidden", { status: 403 });
  }

  const [accountsRes, classesRes] = await Promise.all([
    api.get<{ success: boolean; data: Account[] }>("/accounts"),
    api.get<{ success: boolean; data: ClassInfo[] }>("/accounts/classes"),
  ]);

  return {
    accounts: accountsRes.data.data,
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
// Role label & color helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "أدمن",
  leader: "ليدر",
  teacher: "خادم",
};

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  switch (role) {
    case "admin":
    case "manager":
      return "default";
    case "leader":
      return "secondary";
    default:
      return "outline";
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminAccounts({ loaderData }: Route.ComponentProps) {
  const { accounts: initialAccounts, classes } = loaderData;

  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [sheetMode, setSheetMode] = useState<SheetMode>({ type: "closed" });
  const [filterText, setFilterText] = useState("");

  // Refresh accounts from server
  async function refreshAccounts() {
    try {
      const res = await api.get<{ success: boolean; data: Account[] }>("/accounts");
      setAccounts(res.data.data);
    } catch {
      // silent
    }
  }

  const filteredAccounts = accounts.filter((a) => {
    const q = filterText.trim().toLowerCase();
    if (!q) return true;
    return (
      a.username.toLowerCase().includes(q) ||
      a.real_name.toLowerCase().includes(q)
    );
  });

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
        <h1 className="text-xl font-bold flex-1">إدارة الحسابات</h1>
        <Button size="sm" onClick={() => setSheetMode({ type: "create-account" })}>
          <Plus className="size-4" />
          حساب جديد
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="بحث بالاسم أو اسم المستخدم..."
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
      />

      {/* Accounts list */}
      {filteredAccounts.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {filterText.trim() ? "لا يوجد نتائج" : "لا يوجد حسابات"}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAccounts.map((account) => (
            <AccountCard
              key={account.account_id}
              account={account}
              onAssignRole={() => setSheetMode({ type: "assign-role", account })}
            />
          ))}
        </div>
      )}

      {/* Create Account Sheet */}
      <CreateAccountSheet
        open={sheetMode.type === "create-account"}
        onClose={() => setSheetMode({ type: "closed" })}
        onSuccess={() => {
          refreshAccounts();
        }}
      />

      {/* Assign Role Sheet */}
      {sheetMode.type === "assign-role" && (
        <AssignRoleSheet
          open
          account={sheetMode.account}
          classes={classes}
          onClose={() => setSheetMode({ type: "closed" })}
          onSuccess={() => {
            refreshAccounts();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Card
// ---------------------------------------------------------------------------

function AccountCard({
  account,
  onAssignRole,
}: {
  account: Account;
  onAssignRole: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-semibold text-base truncate">{account.real_name}</span>
            <span className="text-sm text-muted-foreground font-mono" dir="ltr">
              @{account.username}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onAssignRole}>
            <ShieldCheck className="size-4" />
            أدوار
          </Button>
        </div>

        {/* Roles */}
        {account.roles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {account.roles.map((r, i) => (
              <Badge key={i} variant={roleBadgeVariant(r.role)} className="text-xs">
                {ROLE_LABELS[r.role] || r.role} — {r.class_name}
              </Badge>
            ))}
          </div>
        )}
        {account.roles.length === 0 && (
          <span className="text-xs text-muted-foreground">لا يوجد أدوار</span>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create Account Sheet
// ---------------------------------------------------------------------------

function CreateAccountSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState("");
  const [realName, setRealName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setUsername("");
      setRealName("");
      setPassword("");
      setSubmitting(false);
      setApiError(null);
      setCreatedResult(null);
      setCopied(false);
    }
  }, [open]);

  async function handleSubmit() {
    // Validate
    if (!username.trim() || username.trim().length < 1) {
      setApiError("اسم المستخدم مطلوب");
      return;
    }
    if (!/^[a-z_0-9]+$/.test(username.trim())) {
      setApiError("اسم المستخدم يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام و _ فقط");
      return;
    }
    if (!realName.trim() || realName.trim().length < 1) {
      setApiError("الاسم الحقيقي مطلوب");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      const payload: Record<string, string> = {
        username: username.trim(),
        real_name: realName.trim(),
      };
      if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await api.post<CreatedAccount>("/accounts/create", payload);
      setCreatedResult(res.data);
      onSuccess();
      toast.success("تم إنشاء الحساب بنجاح");
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.response?.data?.message?.includes?.("Duplicate")) {
        setApiError("اسم المستخدم موجود بالفعل");
      } else {
        setApiError("حصلت مشكلة، حاول تاني");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyCredentials() {
    if (!createdResult) return;
    const text = `اسم المستخدم: ${username}\nالباسورد: ${createdResult.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <UserPlus className="size-5 inline-block ml-2" />
            إنشاء حساب جديد
          </SheetTitle>
          <SheetDescription>أدخل بيانات الحساب الجديد</SheetDescription>
        </SheetHeader>

        {createdResult ? (
          /* Success state – show credentials */
          <div className="flex flex-col gap-4 px-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex flex-col gap-3">
              <p className="font-semibold text-green-800 dark:text-green-300">
                تم إنشاء الحساب بنجاح!
              </p>
              <div className="flex flex-col gap-1 text-sm">
                <span>
                  <strong>اسم المستخدم:</strong>{" "}
                  <span className="font-mono" dir="ltr">
                    {username}
                  </span>
                </span>
                <span>
                  <strong>الباسورد:</strong>{" "}
                  <span className="font-mono" dir="ltr">
                    {createdResult.password}
                  </span>
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={handleCopyCredentials}
              >
                {copied ? (
                  <>
                    <Check className="size-4" />
                    تم النسخ
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    نسخ البيانات
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Form state */
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">اسم المستخدم</label>
              <Input
                dir="ltr"
                className="text-right"
                placeholder="username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">الاسم الحقيقي</label>
              <Input
                placeholder="الاسم بالعربي"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                الباسورد{" "}
                <span className="text-muted-foreground font-normal">(اختياري — هيتولد تلقائي)</span>
              </label>
              <Input
                dir="ltr"
                className="text-right"
                type="text"
                placeholder="اتركه فاضي للتوليد التلقائي"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {apiError && (
              <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md text-sm text-center">
                {apiError}
              </div>
            )}
          </div>
        )}

        <SheetFooter>
          {createdResult ? (
            <Button className="w-full" onClick={onClose}>
              تم
            </Button>
          ) : (
            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                "إنشاء الحساب"
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Assign Role Sheet
// ---------------------------------------------------------------------------

function AssignRoleSheet({
  open,
  account,
  classes,
  onClose,
  onSuccess,
}: {
  open: boolean;
  account: Account;
  classes: ClassInfo[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");
  const [selectedRole, setSelectedRole] = useState<string>("teacher");
  const [submitting, setSubmitting] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Group classes by school
  const schoolMap = new Map<string, ClassInfo[]>();
  for (const cls of classes) {
    const key = cls.school_name;
    if (!schoolMap.has(key)) schoolMap.set(key, []);
    schoolMap.get(key)!.push(cls);
  }

  async function handleAssign() {
    if (!selectedClassId) {
      setApiError("اختر الفصل");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      await api.post("/roles", {
        user: account.username,
        classId: selectedClassId,
        role: selectedRole,
      });
      onSuccess();
      toast.success("تم إضافة الدور بنجاح");
      setSelectedClassId("");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setApiError("هذا الدور موجود بالفعل");
      } else {
        setApiError("حصلت مشكلة، حاول تاني");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <KeyRound className="size-5 inline-block ml-2" />
            أدوار {account.real_name}
          </SheetTitle>
          <SheetDescription>
            إضافة أو عرض أدوار الحساب @{account.username}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {/* Current roles */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">الأدوار الحالية</h3>
            {account.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا يوجد أدوار</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الدور</TableHead>
                    <TableHead>الفصل</TableHead>
                    <TableHead>الكنيسة</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.roles.map((r) => (
                    <TableRow key={r.role_id}>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(r.role)} className="text-xs">
                          {ROLE_LABELS[r.role] || r.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.class_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.school_name}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              disabled={deletingRoleId === r.role_id}
                            >
                              {deletingRoleId === r.role_id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الدور</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف دور "{ROLE_LABELS[r.role] || r.role}" في فصل "{r.class_name}"؟
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  setDeletingRoleId(r.role_id);
                                  try {
                                    await api.delete(`/accounts/roles/${r.role_id}`);
                                    onSuccess();
                                    toast.success("تم حذف الدور بنجاح");
                                  } catch {
                                    toast.error("حصلت مشكلة في حذف الدور");
                                  } finally {
                                    setDeletingRoleId(null);
                                  }
                                }}
                              >
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Add new role */}
          <div className="border-t pt-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">إضافة دور جديد</h3>

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

            {/* Role select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">الدور</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-primary border-primary h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-lg transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="teacher">خادم</option>
                <option value="leader">ليدر</option>
                <option value="manager">أدمن</option>
                <option value="admin">Admin</option>
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
                  جاري الإضافة...
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  إضافة الدور
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