import type { Route } from "./+types/equipment-group";
import api from "~/lib/api";
import { forceFetchAndCache, resetTimestampCache, registerFetcher, unregisterFetcher } from "~/lib/sync-manager";
import { equipmentGroupItemsKey, equipmentSubgroupsKey, removeCached } from "~/lib/offline-db";
import { getEquipmentPhotoUrl } from "~/lib/utils";
import { usePhotoBlobUrl } from "~/hooks/use-photo-blob-url";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useNavigate, useRevalidator } from "react-router";
import { Plus, Search, ImageIcon, Settings, Package, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EquipmentItem {
  equipment_id: number;
  group_id: number;
  subgroup_id: number | null;
  parent_equipment_id: number | null;
  name: string;
  description: string | null;
  quantity: number;
  photo: string | null;
}

interface EquipmentSubgroup {
  subgroup_id: number;
  name: string;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const groupId = params.groupId;
  const [items, subgroups] = await Promise.all([
    forceFetchAndCache<EquipmentItem[]>(
      equipmentGroupItemsKey(groupId),
      () => api.get(`/equipment/groups/${groupId}/items`).then(r => r.data.data),
    ),
    forceFetchAndCache<EquipmentSubgroup[]>(
      equipmentSubgroupsKey(groupId),
      () => api.get(`/equipment/groups/${groupId}/subgroups`).then(r => r.data.data),
    ),
  ]);
  const groups = await api.get<{ success: boolean; data: { group_id: number; group_name: string; access_level: string }[] }>("/equipment/groups");
  const group = groups.data.data.find((g: any) => String(g.group_id) === groupId);
  return { groupId, group, items, subgroups };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function EquipmentGroup({ loaderData }: Route.ComponentProps) {
  const { groupId, group, items, subgroups } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [search, setSearch] = useState("");
  const [filterSubgroupId, setFilterSubgroupId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const isOrganizer = group?.access_level === "organizer";

  const filteredItems = items.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSubgroupId !== null && item.subgroup_id !== filterSubgroupId) return false;
    return true;
  });

  async function handleDeleteItem(itemId: number | string) {
    if (!confirm("حذف هذا العنصر؟")) return;
    try {
      await api.delete(`/equipment/groups/${groupId}/items/${itemId}`);
      resetTimestampCache();
      await removeCached(equipmentGroupItemsKey(groupId));
      revalidator.revalidate();
    } catch {}
  }

  useEffect(() => {
    registerFetcher(equipmentGroupItemsKey(groupId), () =>
      api.get(`/equipment/groups/${groupId}/items`).then(r => r.data.data),
    );
    registerFetcher(equipmentSubgroupsKey(groupId), () =>
      api.get(`/equipment/groups/${groupId}/subgroups`).then(r => r.data.data),
    );
    return () => {
      unregisterFetcher(equipmentGroupItemsKey(groupId));
      unregisterFetcher(equipmentSubgroupsKey(groupId));
    };
  }, [groupId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{group?.group_name ?? "الوسائل ايضاح"}</h1>
        <div className="flex items-center gap-2">
          {isOrganizer && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate(`/equipment/${groupId}/settings`)}>
                <Settings className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      {subgroups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={filterSubgroupId === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterSubgroupId(null)}
          >
            الكل
          </Badge>
          {subgroups.map((sg: EquipmentSubgroup) => (
            <Badge
              key={sg.subgroup_id}
              variant={filterSubgroupId === sg.subgroup_id ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterSubgroupId(sg.subgroup_id)}
            >
              {sg.name}
            </Badge>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Package className="size-12 text-muted-foreground" />
          <p className="text-muted-foreground">لا توجد عناصر</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredItems.map((item: EquipmentItem) => (
            <ItemCard
              key={item.equipment_id}
              item={item}
              subgroups={subgroups}
              isOrganizer={isOrganizer}
              onDelete={handleDeleteItem}
              onClick={() => navigate(`/equipment/${groupId}/items/${item.equipment_id}`)}
            />
          ))}
        </div>
      )}

      <CreateItemSheet
        groupId={groupId}
        subgroups={subgroups}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          resetTimestampCache();
          removeCached(equipmentGroupItemsKey(groupId));
          revalidator.revalidate();
        }}
      />
    </div>
  );
}

function CreateItemSheet({
  groupId,
  subgroups: initialSubgroups,
  open,
  onOpenChange,
  onSuccess,
}: {
  groupId: string;
  subgroups: EquipmentSubgroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [subgroupId, setSubgroupId] = useState<string>("none");
  const [loading, setLoading] = useState(false);
  const [showNewSubgroup, setShowNewSubgroup] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState("");
  const [creatingSubgroup, setCreatingSubgroup] = useState(false);
  const [subgroups, setSubgroups] = useState(initialSubgroups);

  useEffect(() => {
    setSubgroups(initialSubgroups);
  }, [initialSubgroups]);

  async function handleCreateSubgroup() {
    if (!newSubgroupName.trim()) return;
    setCreatingSubgroup(true);
    try {
      const res = await api.post<{ success: boolean; data: { subgroup_id: number } }>(
        `/equipment/groups/${groupId}/subgroups`,
        { name: newSubgroupName.trim() },
      );
      const newSg: EquipmentSubgroup = {
        subgroup_id: res.data.data.subgroup_id,
        name: newSubgroupName.trim(),
      };
      setSubgroups((prev) => [...prev, newSg]);
      setSubgroupId(String(newSg.subgroup_id));
      setNewSubgroupName("");
      setShowNewSubgroup(false);
      toast.success("تم إنشاء الصنف");
    } catch {
      toast.error("فشل إنشاء الصنف");
    } finally {
      setCreatingSubgroup(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
      };
      if (subgroupId !== "none") {
        payload.subgroup_id = parseInt(subgroupId, 10);
      } else {
        payload.subgroup_id = null;
      }
      await api.post(`/equipment/groups/${groupId}/items`, payload);
      toast.success("تم إنشاء العنصر");
      setName("");
      setDescription("");
      setQuantity("1");
      setSubgroupId("");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("فشل إنشاء العنصر");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8">
        <SheetHeader>
          <SheetTitle>عنصر جديد</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
          <Input
            placeholder="اسم العنصر"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <textarea
            placeholder="وصف (اختياري)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <label className="text-sm font-medium text-muted-foreground">
            الكمية
            <Input
              type="number"
              min={1}
              placeholder="عدد القطع المتوفرة"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
            />
          </label>
          <div>
            <label className="text-sm font-medium text-muted-foreground">الصنف</label>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1">
                <Select value={subgroupId} onValueChange={setSubgroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="صنف (اختياري)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    {subgroups.map((sg: EquipmentSubgroup) => (
                      <SelectItem key={sg.subgroup_id} value={String(sg.subgroup_id)}>
                        {sg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setShowNewSubgroup(true)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {showNewSubgroup && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  placeholder="اسم الصنف"
                  value={newSubgroupName}
                  onChange={(e) => setNewSubgroupName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={creatingSubgroup || !newSubgroupName.trim()}
                  onClick={handleCreateSubgroup}
                >
                  {creatingSubgroup ? <Loader2 className="size-3 animate-spin" /> : "إنشاء"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowNewSubgroup(false); setNewSubgroupName(""); }}
                >
                  إلغاء
                </Button>
              </div>
            )}
          </div>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            إنشاء
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ItemCard({
  item,
  subgroups,
  isOrganizer,
  onDelete,
  onClick,
}: {
  item: EquipmentItem;
  subgroups: EquipmentSubgroup[];
  isOrganizer: boolean;
  onDelete: (id: number) => void;
  onClick: () => void;
}) {
  const { blobUrl } = usePhotoBlobUrl(item.photo, "md", getEquipmentPhotoUrl);

  const subgroupName = item.subgroup_id
    ? subgroups.find((sg) => sg.subgroup_id === item.subgroup_id)?.name
    : null;

  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent/50 w-full relative" onClick={onClick}>
      {item.parent_equipment_id && (
        <Badge variant="outline" className="absolute top-2 left-2 text-[10px] px-1.5 py-0 h-5">
          مرفق
        </Badge>
      )}
      <CardContent className="p-4 flex flex-col items-center gap-3">
        {blobUrl ? (
          <div className="size-32 rounded-lg overflow-hidden shrink-0 bg-muted">
            <img src={blobUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="size-32 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <ImageIcon className="size-8 text-muted-foreground" />
          </div>
        )}
        <div className="w-full">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{item.name}</p>
              {item.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
              )}
            </div>
            {item.quantity !== 1 && <Badge variant="secondary" className="shrink-0">{item.quantity}</Badge>}
          </div>
          {subgroupName && (
            <p className="text-xs text-muted-foreground mt-1">{subgroupName}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
