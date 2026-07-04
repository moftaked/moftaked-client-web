import type { Route } from "./+types/equipment-group-settings";
import api from "~/lib/api";
import { resetTimestampCache } from "~/lib/sync-manager";
import { equipmentGroupItemsKey, equipmentSubgroupsKey, removeCached } from "~/lib/offline-db";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { useRevalidator } from "react-router";
import { Loader2, Plus, Trash2, UserPlus, Users, Pencil, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "~/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";

interface EquipmentMember {
  id: number;
  account_id: number;
  access_level: "organizer" | "member";
  username: string;
  real_name: string;
}

interface EquipmentSubgroup {
  subgroup_id: number;
  name: string;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const groupId = params.groupId;
  const [members, subgroups] = await Promise.all([
    api.get<{ success: boolean; data: EquipmentMember[] }>(
      `/equipment/groups/${groupId}/members`
    ).then(r => r.data.data),
    api.get<{ success: boolean; data: EquipmentSubgroup[] }>(
      `/equipment/groups/${groupId}/subgroups`
    ).then(r => r.data.data),
  ]);
  return { groupId, members, subgroups };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

export default function EquipmentGroupSettings({ loaderData }: Route.ComponentProps) {
  const { groupId, members, subgroups } = loaderData;
  const revalidator = useRevalidator();

  const [subgroupName, setSubgroupName] = useState("");
  const [addingSubgroup, setAddingSubgroup] = useState(false);

  const [memberUsername, setMemberUsername] = useState("");
  const [memberAccessLevel, setMemberAccessLevel] = useState<"organizer" | "member">("member");
  const [addingMember, setAddingMember] = useState(false);
  const [deleteSubgroupConfirm, setDeleteSubgroupConfirm] = useState<number | null>(null);
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<number | null>(null);
  const [editingSubgroupId, setEditingSubgroupId] = useState<number | null>(null);
  const [editSubgroupName, setEditSubgroupName] = useState("");
  const [editMemberTarget, setEditMemberTarget] = useState<EquipmentMember | null>(null);
  const [editMemberLevel, setEditMemberLevel] = useState<"organizer" | "member">("member");

  async function handleAddSubgroup(e: React.FormEvent) {
    e.preventDefault();
    if (!subgroupName.trim()) return;
    setAddingSubgroup(true);
    try {
      await api.post(`/equipment/groups/${groupId}/subgroups`, { name: subgroupName.trim() });
      resetTimestampCache();
      await Promise.all([
        removeCached(equipmentGroupItemsKey(groupId)),
        removeCached(equipmentSubgroupsKey(groupId)),
      ]);
      toast.success("تم إنشاء الصنف");
      setSubgroupName("");
      revalidator.revalidate();
    } catch {
      toast.error("فشل إنشاء الصنف");
    } finally {
      setAddingSubgroup(false);
    }
  }

  async function handleDeleteSubgroup(subgroupId: number) {
    setDeleteSubgroupConfirm(null);
    try {
      await api.delete(`/equipment/groups/${groupId}/subgroups/${subgroupId}`);
      resetTimestampCache();
      await Promise.all([
        removeCached(equipmentGroupItemsKey(groupId)),
        removeCached(equipmentSubgroupsKey(groupId)),
      ]);
      revalidator.revalidate();
    } catch {
      toast.error("فشل الحذف");
    }
  }

  function handleStartEditSubgroup(sg: EquipmentSubgroup) {
    setEditingSubgroupId(sg.subgroup_id);
    setEditSubgroupName(sg.name);
  }

  async function handleSaveSubgroup(subgroupId: number) {
    if (!editSubgroupName.trim()) return;
    try {
      await api.put(`/equipment/groups/${groupId}/subgroups/${subgroupId}`, { name: editSubgroupName.trim() });
      resetTimestampCache();
      await Promise.all([
        removeCached(equipmentGroupItemsKey(groupId)),
        removeCached(equipmentSubgroupsKey(groupId)),
      ]);
      setEditingSubgroupId(null);
      revalidator.revalidate();
    } catch {
      toast.error("فشل التحديث");
    }
  }

  function handleCancelEditSubgroup() {
    setEditingSubgroupId(null);
    setEditSubgroupName("");
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberUsername.trim()) return;
    setAddingMember(true);
    try {
      await api.post(`/equipment/groups/${groupId}/members`, {
        username: memberUsername.trim(),
        access_level: memberAccessLevel,
      });
      toast.success("تم إضافة العضو");
      setMemberUsername("");
      revalidator.revalidate();
    } catch {
      toast.error("فشل إضافة العضو");
    } finally {
      setAddingMember(false);
    }
  }

  function handleOpenEditMember(member: EquipmentMember) {
    setEditMemberTarget(member);
    setEditMemberLevel(member.access_level);
  }

  async function handleSaveMemberAccess() {
    if (!editMemberTarget) return;
    const member = editMemberTarget;
    setEditMemberTarget(null);
    try {
      await api.put(`/equipment/groups/${groupId}/members/${member.id}`, { access_level: editMemberLevel });
      revalidator.revalidate();
      toast.success("تم تحديث الصلاحية");
    } catch {
      toast.error("فشل تحديث الصلاحية");
    }
  }

  async function handleRemoveMember(memberId: number) {
    setRemoveMemberConfirm(null);
    try {
      await api.delete(`/equipment/groups/${groupId}/members/${memberId}`);
      revalidator.revalidate();
    } catch {
      toast.error("فشل إزالة العضو");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">الإعدادات</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" />
            المجموعات الفرعية
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {subgroups.map((sg: EquipmentSubgroup) => (
            <div key={sg.subgroup_id} className="flex items-center justify-between py-1 gap-2">
              {editingSubgroupId === sg.subgroup_id ? (
                <>
                  <Input
                    value={editSubgroupName}
                    onChange={(e) => setEditSubgroupName(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => handleSaveSubgroup(sg.subgroup_id)}>
                    <Check className="size-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={handleCancelEditSubgroup}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1">{sg.name}</span>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => handleStartEditSubgroup(sg)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <AlertDialog open={deleteSubgroupConfirm === sg.subgroup_id} onOpenChange={(o) => { if (!o) setDeleteSubgroupConfirm(null); }}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setDeleteSubgroupConfirm(sg.subgroup_id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>حذف هذه الصنف؟</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>لأ</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteSubgroup(sg.subgroup_id)}>أكيد</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          ))}
          <form onSubmit={handleAddSubgroup} className="flex items-center gap-2">
            <Input
              placeholder="اسم الصنف"
              value={subgroupName}
              onChange={(e) => setSubgroupName(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={addingSubgroup || !subgroupName.trim()}>
              {addingSubgroup ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            الأعضاء
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {members.map((m: EquipmentMember) => (
            <div key={m.id} className="flex items-center justify-between py-1">
              <div className="flex flex-col">
                <span>{m.real_name || m.username}</span>
                <span className="text-xs text-muted-foreground">{m.username}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {m.access_level === "organizer" ? "خادم اوضة" : "خادم"}
                </Badge>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => handleOpenEditMember(m)}>
                  <Pencil className="size-3.5" />
                </Button>
                <AlertDialog open={removeMemberConfirm === m.id} onOpenChange={(o) => { if (!o) setRemoveMemberConfirm(null); }}>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setRemoveMemberConfirm(m.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد الإزالة</AlertDialogTitle>
                      <AlertDialogDescription>إزالة هذا العضو؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>لأ</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRemoveMember(m.id)}>أكيد</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          <form onSubmit={handleAddMember} className="flex items-center gap-2">
            <Input
              placeholder="اسم المستخدم"
              value={memberUsername}
              onChange={(e) => setMemberUsername(e.target.value)}
              className="flex-1"
            />
            <Select
              value={memberAccessLevel}
              onValueChange={(v) => setMemberAccessLevel(v as "organizer" | "member")}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">خادم</SelectItem>
                <SelectItem value="organizer">خادم اوضة</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" disabled={addingMember || !memberUsername.trim()}>
              {addingMember ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Sheet open={editMemberTarget !== null} onOpenChange={(o) => { if (!o) setEditMemberTarget(null); }}>
        <SheetContent side="bottom" className="max-h-[40dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>تعديل صلاحية العضو</SheetTitle>
            <SheetDescription>
              {editMemberTarget?.real_name || editMemberTarget?.username}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">
            <Select
              value={editMemberLevel}
              onValueChange={(v) => setEditMemberLevel(v as "organizer" | "member")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">خادم</SelectItem>
                <SelectItem value="organizer">خادم اوضة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SheetFooter>
            <Button onClick={handleSaveMemberAccess}>حفظ</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
