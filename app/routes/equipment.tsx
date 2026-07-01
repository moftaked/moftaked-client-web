import type { Route } from "./+types/equipment";
import api from "~/lib/api";
import { fetchAndCache, resetTimestampCache } from "~/lib/sync-manager";
import { EQUIPMENT_GROUPS_KEY, removeCached } from "~/lib/offline-db";
import { isAdmin } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { useNavigate, useRevalidator } from "react-router";
import { Plus, Settings, DoorOpen, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EquipmentGroup {
  group_id: number;
  group_name: string;
  access_level: "organizer" | "member";
}

export async function clientLoader() {
  const groups = await fetchAndCache<EquipmentGroup[]>(
    EQUIPMENT_GROUPS_KEY,
    async () => {
      const res = await api.get<{ success: boolean; data: EquipmentGroup[] }>("/equipment/groups");
      return res.data.data;
    }
  );
  return { groups };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Skeleton className="h-18 w-full rounded-xl" />
        <Skeleton className="h-18 w-full rounded-xl" />
        <Skeleton className="h-18 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function Equipment({ loaderData }: Route.ComponentProps) {
  const { groups } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setCreating(true);
    try {
      await api.post("/equipment/groups", { group_name: groupName.trim() });
      resetTimestampCache();
      await removeCached(EQUIPMENT_GROUPS_KEY);
      toast.success("تم إنشاء المجموعة");
      setCreateOpen(false);
      setGroupName("");
      revalidator.revalidate();
    } catch {
      toast.error("فشل إنشاء المجموعة");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">وسائل الإيضاح</h1>
        {isAdmin() && (
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            مجموعة جديدة
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <DoorOpen className="size-12 text-muted-foreground" />
          <p className="text-muted-foreground">لا توجد مجموعات وسائل ايضاح متاحة</p>
          {isAdmin() && (
            <Button variant="default" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              إنشاء أول مجموعة
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((group: EquipmentGroup) => (
            <Card
              key={group.group_id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => navigate(`/equipment/${group.group_id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <DoorOpen className="size-5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{group.group_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {group.access_level === "organizer" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/equipment/${group.group_id}/settings`);
                      }}
                    >
                      <Settings className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="flex flex-col gap-4 pb-8">
          <SheetHeader>
            <SheetTitle>مجموعة جديدة</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleCreateGroup} className="flex flex-col gap-4 px-4">
            <Input
              placeholder="اسم المجموعة"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
            <Button type="submit" disabled={creating || !groupName.trim()}>
              {creating && <Loader2 className="size-4 animate-spin" />}
              إنشاء
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
