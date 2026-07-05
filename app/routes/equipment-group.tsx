import type { Route } from "./+types/equipment-group";
import api from "~/lib/api";
import { forceFetchAndCache, registerFetcher, unregisterFetcher } from "~/lib/sync-manager";
import { equipmentSubgroupsKey } from "~/lib/offline-db";
import { getEquipmentPhotoUrl, getAccountId } from "~/lib/utils";
import { usePhotoBlobUrl } from "~/hooks/use-photo-blob-url";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { DatePicker } from "~/components/ui/date-picker";
import { useNavigate, useRevalidator, useSearchParams } from "react-router";
import { Plus, Search, ImageIcon, Settings, Package, Loader2, Calendar, User, Users, Trash2, ChevronDown } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
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
  item_count: number;
}

interface Reservation {
  reservation_id: number;
  class_id: number;
  class_name: string;
  receiver_person_id: number;
  pickup_datetime: string;
  return_datetime: string;
  state: string;
  notes: string | null;
  created_by: number;
  creator_name: string;
  creator_real_name: string;
  receiver_name: string;
  created_at: string;
  group_id: number | null;
}

interface ClassInfo {
  class_id: number;
  class_name: string;
}

const RESERVATION_STATE_LABELS: Record<string, string> = {
  draft: "مسودة",
  waiting_for_approval: "بانتظار المراجعة",
  reserved: "مؤكد",
  waiting_for_pickup: "بانتظار الاستلام",
  picked_up: "تم الاستلام",
  waiting_for_return: "بانتظار الإرجاع",
  returned: "تم الإرجاع",

};

const RESERVATION_STATE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  waiting_for_approval: "secondary",
  reserved: "default",
  waiting_for_pickup: "default",
  picked_up: "secondary",
  waiting_for_return: "destructive",
  returned: "outline",

};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const groupId = params.groupId;
  const subgroupsRes = await forceFetchAndCache<{ success: boolean; data: EquipmentSubgroup[]; ungrouped_count: number }>(
    equipmentSubgroupsKey(groupId),
    () => api.get(`/equipment/groups/${groupId}/subgroups`).then(r => r.data),
  );
  const subgroups = subgroupsRes.data;
  const ungroupedItemCount = subgroupsRes.ungrouped_count ?? 0;
  const groups = await api.get<{ success: boolean; data: { group_id: number; group_name: string; access_level: string }[] }>("/equipment/groups");
  const group = groups.data.data.find((g: any) => String(g.group_id) === groupId);
  return { groupId, group, subgroups, ungroupedItemCount };
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
  const { groupId, group, subgroups: initialSubgroups, ungroupedItemCount } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [search, setSearch] = useState("");
  const [subgroups, setSubgroups] = useState(initialSubgroups);
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<number>>(new Set());
  const [subgroupItems, setSubgroupItems] = useState<Record<number, EquipmentItem[]>>({});
  const [subgroupItemsLoading, setSubgroupItemsLoading] = useState<Record<number, boolean>>({});
  // Ungrouped items (subgroup_id === null)
  const [ungroupedItems, setUngroupedItems] = useState<EquipmentItem[]>([]);
  const [ungroupedItemsLoading, setUngroupedItemsLoading] = useState(false);
  const [ungroupedItemsExpanded, setUngroupedItemsExpanded] = useState(false);
  const [ungroupedItemsFetched, setUngroupedItemsFetched] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "items";
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  const isOrganizer = group?.access_level === "organizer";
  const itemsTabName = group?.group_name?.split(" ").slice(1).join(" ") || "الأجهزة";

  function getAllLoadedItems(): EquipmentItem[] {
    const all = [...ungroupedItems];
    for (const items of Object.values(subgroupItems)) {
      all.push(...items);
    }
    return all;
  }

  async function fetchSubgroupItems(subgroupId: number) {
    if (subgroupItems[subgroupId] !== undefined) return;
    setSubgroupItemsLoading(prev => ({ ...prev, [subgroupId]: true }));
    try {
      const res = await api.get(`/equipment/groups/${groupId}/items?subgroupId=${subgroupId}`);
      setSubgroupItems(prev => ({ ...prev, [subgroupId]: res.data.data }));
    } catch {
      toast.error("فشل تحميل العناصر");
    } finally {
      setSubgroupItemsLoading(prev => ({ ...prev, [subgroupId]: false }));
    }
  }

  async function fetchUngroupedItems() {
    if (ungroupedItemsFetched) return;
    setUngroupedItemsLoading(true);
    try {
      const res = await api.get(`/equipment/groups/${groupId}/items?subgroupId=-1`);
      setUngroupedItems(res.data.data);
      setUngroupedItemsFetched(true);
    } catch {
      toast.error("فشل تحميل العناصر");
    } finally {
      setUngroupedItemsLoading(false);
    }
  }

  async function handleDeleteItem(itemId: number | string) {
    if (!confirm("حذف هذا العنصر؟")) return;
    try {
      await api.delete(`/equipment/groups/${groupId}/items/${itemId}`);
      // Remove from local state to avoid re-fetch
      setSubgroupItems(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[Number(key)] = next[Number(key)].filter(i => i.equipment_id !== Number(itemId));
        }
        return next;
      });
      setUngroupedItems(prev => prev.filter(i => i.equipment_id !== Number(itemId)));
      // Re-fetch subgroups to refresh counts (empty subgroups may need to disappear)
      const res = await api.get(`/equipment/groups/${groupId}/subgroups`).then(r => r.data);
      setSubgroups(res.data);
    } catch {}
  }

  useEffect(() => {
    registerFetcher(equipmentSubgroupsKey(groupId), () =>
      api.get(`/equipment/groups/${groupId}/subgroups`).then(r => r.data),
    );
    return () => {
      unregisterFetcher(equipmentSubgroupsKey(groupId));
    };
  }, [groupId]);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsFetched, setReservationsFetched] = useState(false);
  const reservationStateFilter = searchParams.get("rtab") || "not_reserved";
  const [createReservationOpen, setCreateReservationOpen] = useState(false);
  useEffect(() => {
    if (activeTab === "reservations" && !reservationsFetched) {
      setReservationsLoading(true);
      api.get(`/reservations?group_id=${groupId}`)
        .then(r => setReservations(r.data.data ?? []))
        .catch(() => toast.error("فشل تحميل الحجوزات"))
        .finally(() => { setReservationsLoading(false); setReservationsFetched(true); });
    }
  }, [activeTab, reservationsFetched]);

  const filteredReservations = reservations.filter(r => {
    if (reservationStateFilter === "returned") return r.state === "returned";
    if (reservationStateFilter === "not_reserved") return r.state === "draft" || r.state === "waiting_for_approval";
    if (reservationStateFilter === "reserved") return r.state !== "returned" && r.state !== "draft" && r.state !== "waiting_for_approval";
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{group?.group_name ?? "الوسائل ايضاح"}</h1>
        <div className="flex items-center gap-2">
          {isOrganizer && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/equipment/${groupId}/settings`)}>
              <Settings className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="items" className="flex-1">{itemsTabName}</TabsTrigger>
          <TabsTrigger value="reservations" className="flex-1">الحجوزات</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex-1" />
              {isOrganizer && (
                <Button variant="outline" size="sm" onClick={() => setCreateItemOpen(true)}>
                  <Plus className="size-4" />
                </Button>
              )}
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

            {subgroups.filter(sg => sg.item_count > 0).length === 0 && ungroupedItemCount === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Package className="size-12 text-muted-foreground" />
                <p className="text-muted-foreground">لا توجد عناصر</p>
              </div>
            )}

            {/* Ungrouped items section */}
            {ungroupedItemCount > 0 && (
              <SubgroupSection
                title="عام"
                expanded={ungroupedItemsExpanded}
                loading={ungroupedItemsLoading}
                onToggle={() => {
                  if (ungroupedItemsExpanded) {
                    setUngroupedItemsExpanded(false);
                  } else {
                    setUngroupedItemsExpanded(true);
                    if (!ungroupedItemsFetched) fetchUngroupedItems();
                  }
                }}
                search={search}
                items={ungroupedItems}
                itemCount={ungroupedItemCount}
                subgroups={subgroups}
                isOrganizer={isOrganizer}
                onDelete={handleDeleteItem}
                groupId={groupId}
              />
            )}

            {/* Subgroup sections */}
            {subgroups.filter(sg => sg.item_count > 0).map((sg: EquipmentSubgroup) => {
              const isExpanded = expandedSubgroups.has(sg.subgroup_id);
              const items = subgroupItems[sg.subgroup_id] ?? [];
              return (
                <SubgroupSection
                  key={sg.subgroup_id}
                  title={sg.name}
                  expanded={isExpanded}
                  loading={subgroupItemsLoading[sg.subgroup_id] ?? false}
                  onToggle={() => {
                    if (isExpanded) {
                      setExpandedSubgroups(prev => { const n = new Set(prev); n.delete(sg.subgroup_id); return n; });
                    } else {
                      setExpandedSubgroups(prev => { const n = new Set(prev); n.add(sg.subgroup_id); return n; });
                      fetchSubgroupItems(sg.subgroup_id);
                    }
                  }}
                  search={search}
                  items={items}
                  itemCount={sg.item_count}
                  subgroups={subgroups}
                  isOrganizer={isOrganizer}
                  onDelete={handleDeleteItem}
                  groupId={groupId}
                />
              );
            })}

            <CreateItemSheet
              groupId={groupId}
              subgroups={subgroups}
              open={createItemOpen}
              onOpenChange={setCreateItemOpen}
              onSuccess={() => {
                setSubgroupItems({});
                setUngroupedItems([]);
                setUngroupedItemsFetched(false);
                setUngroupedItemsExpanded(false);
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="reservations">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between" dir="rtl">
              <h2 className="text-lg font-bold">الحجوزات</h2>
              <Button variant="outline" size="sm" onClick={() => setCreateReservationOpen(true)}>
                <Plus className="size-4" />
                حجز جديد
              </Button>
            </div>

            <Tabs value={reservationStateFilter} onValueChange={(v) => setSearchParams({ ...Object.fromEntries(searchParams), rtab: v }, { replace: true })}>
              <TabsList className="w-full overflow-x-auto">
                <TabsTrigger value="not_reserved">لسة متحجزتش</TabsTrigger>
                <TabsTrigger value="reserved">محجوز</TabsTrigger>
                <TabsTrigger value="returned">تم الإرجاع</TabsTrigger>
              </TabsList>
            </Tabs>

            {reservationsLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : filteredReservations.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <Calendar className="size-12 text-muted-foreground" />
                <p className="text-muted-foreground">لا توجد حجوزات</p>
                <Button variant="outline" onClick={() => setCreateReservationOpen(true)}>
                  <Plus className="size-4" />
                  إنشاء حجز جديد
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredReservations.map(r => (
                  <ReservationCard
                    key={r.reservation_id}
                    reservation={r}
                    onClick={() => navigate(`/reservations/${r.reservation_id}`)}
                  />
                ))}
              </div>
            )}

            <CreateReservationSheet
              open={createReservationOpen}
              onOpenChange={setCreateReservationOpen}
              groupId={groupId}
              onSuccess={() => {
                setReservationsFetched(false);
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
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
  const pendingSelectRef = useRef<string | null>(null);

  useEffect(() => {
    setSubgroups(initialSubgroups);
  }, [initialSubgroups]);

  useEffect(() => {
    if (pendingSelectRef.current !== null) {
      setSubgroupId(pendingSelectRef.current);
      pendingSelectRef.current = null;
    }
  }, [subgroups]);

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
        item_count: 0,
      };
      setSubgroups((prev) => [...prev, newSg]);
      pendingSelectRef.current = String(newSg.subgroup_id);
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

function SubgroupSection({
  title,
  expanded,
  loading,
  onToggle,
  search,
  items,
  itemCount,
  subgroups,
  isOrganizer,
  onDelete,
  groupId,
}: {
  title: string;
  expanded: boolean;
  loading: boolean;
  onToggle: () => void;
  search: string;
  items: EquipmentItem[];
  itemCount: number;
  subgroups: EquipmentSubgroup[];
  isOrganizer: boolean;
  onDelete: (id: number | string) => void;
  groupId: string;
}) {
  const navigate = useNavigate();
  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full p-3 text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        <ChevronDown className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`} />
        {title}
        <span className="text-xs text-muted-foreground">({itemCount})</span>
      </button>
      {expanded && (
        <div className="border-t p-3">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {search ? "لا توجد نتائج" : "لا توجد عناصر"}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 [direction:rtl]">
              {filtered.map((item: EquipmentItem) => (
                <ItemCard
                  key={item.equipment_id}
                  item={item}
                  subgroups={subgroups}
                  isOrganizer={isOrganizer}
                  onDelete={onDelete}
                  onClick={() => navigate(`/equipment/${groupId}/items/${item.equipment_id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false);
  const { blobUrl } = usePhotoBlobUrl(item.photo, "md", getEquipmentPhotoUrl);

  const subgroupName = item.subgroup_id
    ? subgroups.find((sg) => sg.subgroup_id === item.subgroup_id)?.name
    : null;

  return (
    <>
      {fullscreenPhoto && blobUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setFullscreenPhoto(false)}>
          <img src={blobUrl} alt="" className="max-h-[90dvh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <Card className="cursor-pointer transition-colors hover:bg-accent/50 w-full relative" onClick={onClick}>
        {item.parent_equipment_id && (
          <Badge variant="outline" className="absolute top-2 left-2 text-[10px] px-1.5 py-0 h-5">
            مرفق
          </Badge>
        )}
        <CardContent className="p-4 flex flex-col items-center gap-3">
          {blobUrl ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); setFullscreenPhoto(true); }} className="size-32 rounded-lg overflow-hidden shrink-0 bg-muted">
              <img src={blobUrl} alt="" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" />
            </button>
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
    </>
  );
}

function ReservationCard({ reservation, onClick }: { reservation: Reservation; onClick: () => void }) {
  const pickup = new Date(reservation.pickup_datetime);
  const ret = new Date(reservation.return_datetime);

  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{reservation.class_name}</span>
          <Badge variant={RESERVATION_STATE_VARIANTS[reservation.state] ?? "outline"}>
            {RESERVATION_STATE_LABELS[reservation.state] ?? reservation.state}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {pickup.toLocaleDateString("ar-SA") === ret.toLocaleDateString("ar-SA") ? pickup.toLocaleDateString("ar-SA") : `${pickup.toLocaleDateString("ar-SA")} - ${ret.toLocaleDateString("ar-SA")}`}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {reservation.receiver_name === (reservation.creator_real_name || reservation.creator_name) ? (
            <span className="flex items-center gap-1">
              <User className="size-3" />
              {reservation.creator_real_name || reservation.creator_name}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {reservation.creator_real_name || reservation.creator_name}
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {reservation.receiver_name}
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SelectedEquipRow({ item, attachments, onQuantityChange, onRemove }: { item: { equipment_id: number; name: string; photo?: string | null; quantity: number; maxQuantity: number }; attachments: { equipment_id: number; name: string }[]; onQuantityChange: (id: number, qty: number) => void; onRemove: (id: number) => void }) {
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false);
  const { blobUrl, loading } = usePhotoBlobUrl(item.photo, "md", getEquipmentPhotoUrl);
  return (
    <>
      {fullscreenPhoto && blobUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setFullscreenPhoto(false)}>
          <img src={blobUrl} alt="" className="max-h-[90dvh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <div className="rounded-lg border p-2">
        <div className="flex items-center gap-2">
          <div className="size-7 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
            {loading ? <div className="size-full animate-pulse bg-muted" /> : blobUrl ? <img src={blobUrl} alt="" className="size-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFullscreenPhoto(true); }} /> : <ImageIcon className="size-3.5 text-muted-foreground" />}
          </div>
          <span className="text-sm flex-1 truncate">{item.name}</span>
        {item.maxQuantity > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onQuantityChange(item.equipment_id, item.quantity + 1)}
            disabled={item.quantity >= item.maxQuantity}
            className="size-7 rounded border flex items-center justify-center text-sm hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            +
          </button>
          <span className="w-8 text-center text-xs tabular-nums">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(item.equipment_id, item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="size-7 rounded border flex items-center justify-center text-sm hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            -
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onRemove(item.equipment_id)}
        className="text-destructive hover:text-destructive/80"
      >
        <Trash2 className="size-3.5" />
      </button>
      </div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {attachments.map(a => (
            <span key={a.equipment_id} className="text-[10px] px-1.5 py-0.5 rounded-full border border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
              {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

function EquipSelectButton({ item, onClick, disabled }: { item: { equipment_id: number; name: string; photo?: string | null; quantity: number; available_quantity?: number }; onClick: () => void; disabled: boolean }) {
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false);
  const { blobUrl, loading } = usePhotoBlobUrl(item.photo, "md", getEquipmentPhotoUrl);
  return (
    <>
      {fullscreenPhoto && blobUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setFullscreenPhoto(false)}>
          <img src={blobUrl} alt="" className="max-h-[90dvh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg border p-2 text-start hover:bg-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
      >
        <div className="size-7 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
          {loading ? <div className="size-full animate-pulse bg-muted" /> : blobUrl ? <img src={blobUrl} alt="" className="size-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); setFullscreenPhoto(true); }} /> : <ImageIcon className="size-3.5 text-muted-foreground" />}
        </div>
      <span className="font-medium flex-1 truncate">{item.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {item.available_quantity !== undefined
          ? item.available_quantity < item.quantity && `${item.available_quantity}/${item.quantity}`
          : item.quantity > 1 && item.quantity}
      </span>
    </button>
    </>
  );
}

function CreateReservationSheet({
  open,
  onOpenChange,
  groupId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  onSuccess: () => void;
}) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [receiverId, setReceiverId] = useState<string>("");
  const [receiverSearch, setReceiverSearch] = useState("");
  const [teachers, setTeachers] = useState<{ teacher_id: number; teacher_name: string }[]>([]);
  const [pickupDatetime, setPickupDatetime] = useState("");
  const [returnDatetime, setReturnDatetime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const [equipItems, setEquipItems] = useState<{ equipment_id: number; name: string; quantity: number; available_quantity?: number; photo?: string | null; parent_equipment_id?: number | null }[]>([]);
  const [equipLoading, setEquipLoading] = useState(false);
  const [equipSearch, setEquipSearch] = useState("");
  const [selectedEquip, setSelectedEquip] = useState<{ equipment_id: number; name: string; quantity: number; maxQuantity: number; photo?: string | null }[]>([]);

  useEffect(() => {
    if (!open) return;
    setClassId("");
    setReceiverId("");
    setReceiverSearch("");
    setTeachers([]);
    setPickupDatetime("");
    setReturnDatetime("");
    setNotes("");
    setEquipItems([]);
    setSelectedEquip([]);
    setEquipSearch("");
    api.get<{ school_id: number; school_name: string; classes: ClassInfo[] }[]>("/classes")
      .then(r => setClasses(r.data.flatMap(s => s.classes)))
      .catch(() => toast.error("فشل تحميل الفصول"));
  }, [open]);

  // Auto-select class when only one is available
  useEffect(() => {
    if (classes.length === 1 && !classId) {
      setClassId(String(classes[0].class_id));
    }
  }, [classes]);

  useEffect(() => {
    if (!pickupDatetime || !returnDatetime) return;
    setEquipLoading(true);
    api.get(`/equipment/groups/${groupId}/items`, {
      params: { pickup_datetime: pickupDatetime, return_datetime: returnDatetime },
    })
      .then(r => setEquipItems(r.data.data))
      .catch(() => toast.error("فشل تحميل الادوات"))
      .finally(() => setEquipLoading(false));
  }, [pickupDatetime, returnDatetime]);

  const selectedClassId = classId ? parseInt(classId, 10) : null;
  useEffect(() => {
    if (!selectedClassId) { setTeachers([]); return; }
    api.get<{ success: boolean; data: { teacher_id: number; teacher_name: string }[] }>(`/classes/${selectedClassId}/teachers`)
      .then(r => setTeachers(r.data.data))
      .catch(() => toast.error("فشل تحميل الخدام"));
  }, [selectedClassId]);

  const filteredTeachers = receiverSearch.trim()
    ? teachers.filter(t => t.teacher_name.includes(receiverSearch.trim()))
    : teachers;

  const childrenMap = useMemo(() => {
    const map = new Map<number, { equipment_id: number; name: string }[]>();
    for (const ei of equipItems) {
      if (ei.parent_equipment_id) {
        const list = map.get(ei.parent_equipment_id) ?? [];
        list.push({ equipment_id: ei.equipment_id, name: ei.name });
        map.set(ei.parent_equipment_id, list);
      }
    }
    return map;
  }, [equipItems]);

  const filteredEquip = equipItems
    .filter(i => {
      const available = i.available_quantity ?? i.quantity;
      return available > 0;
    })
    .filter(i => !equipSearch.trim() || i.name.includes(equipSearch.trim()));

  function handleAddEquipment(item: { equipment_id: number; name: string; quantity: number; available_quantity?: number; photo?: string | null; parent_equipment_id?: number | null }) {
    const available = item.available_quantity ?? item.quantity;
    setSelectedEquip((prev) => {
      if (prev.some(e => e.equipment_id === item.equipment_id)) return prev;
      // If item's parent is already selected, skip (it's already covered as an attachment)
      if (item.parent_equipment_id && prev.some(e => e.equipment_id === item.parent_equipment_id)) return prev;
      // Remove any selected items that are attachments of this item
      const childIds = new Set(equipItems.filter(ei => ei.parent_equipment_id === item.equipment_id).map(ei => ei.equipment_id));
      return [...prev.filter(e => !childIds.has(e.equipment_id)), { equipment_id: item.equipment_id, name: item.name, quantity: 1, maxQuantity: available, photo: item.photo }];
    });
  }

  function handleRemoveEquipment(equipmentId: number) {
    setSelectedEquip((prev) => prev.filter(e => e.equipment_id !== equipmentId));
  }

  function handleQuantityChange(equipmentId: number, quantity: number) {
    setSelectedEquip((prev) =>
      prev.map(e => e.equipment_id === equipmentId ? { ...e, quantity: Math.max(1, Math.min(quantity, e.maxQuantity)) } : e)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId || !receiverId || !pickupDatetime || !returnDatetime) return;
    if (new Date(returnDatetime) <= new Date(pickupDatetime)) {
      toast.error("وقت الإرجاع يجب أن يكون بعد وقت الاستلام");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: { reservation_id: number } }>("/reservations", {
        class_id: parseInt(classId, 10),
        receiver_person_id: parseInt(receiverId, 10),
        pickup_datetime: pickupDatetime,
        return_datetime: returnDatetime,
        notes: notes.trim() || null,
        group_id: parseInt(groupId, 10),
      });
      const reservationId = res.data.data.reservation_id;
      for (const eq of selectedEquip) {
        await api.post(`/reservations/${reservationId}/items`, {
          equipment_id: eq.equipment_id,
          quantity: eq.quantity,
        });
      }
      toast.success("تم إنشاء الحجز");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("فشل إنشاء الحجز");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4 pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>حجز جديد</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
          <label className="text-sm font-medium text-muted-foreground">
            الخدمة
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="اختر الخدمة" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.class_id} value={String(c.class_id)}>{c.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="text-sm font-medium text-muted-foreground">
            المستلم
            <div className="flex items-center gap-2 mt-1">
              <div className="relative flex-1">
                <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="ابحث باسم الخادم..."
                  value={receiverSearch}
                  onChange={(e) => { setReceiverSearch(e.target.value); setReceiverId(""); }}
                  className="pr-9"
                />
              </div>
            </div>
            {receiverSearch.trim() && filteredTeachers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
                {filteredTeachers.slice(0, 20).map(t => (
                  <button
                    key={t.teacher_id}
                    type="button"
                    onClick={() => { setReceiverId(String(t.teacher_id)); setReceiverSearch(t.teacher_name); }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      receiverId === String(t.teacher_id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    {t.teacher_name}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="text-sm font-medium text-muted-foreground">
            وقت الاستلام
            <DatePicker
              value={pickupDatetime}
              onChange={setPickupDatetime}
              showTime
            />
          </label>

          <label className="text-sm font-medium text-muted-foreground">
            وقت الإرجاع
            <DatePicker
              value={returnDatetime}
              onChange={setReturnDatetime}
              showTime
            />
          </label>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">الادوات</p>
            <Input
              placeholder="بحث..."
              value={equipSearch}
              onChange={(e) => setEquipSearch(e.target.value)}
            />
            <div className="flex flex-col gap-1.5 mt-2 max-h-32 overflow-y-auto">
              {!pickupDatetime || !returnDatetime ? (
                <p className="text-xs text-muted-foreground text-center py-2">اختر وقت الاستلام والإرجاع لعرض الادوات المتاحة</p>
              ) : equipLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)
              ) : filteredEquip.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">لا توجد نتائج</p>
              ) : (
                  filteredEquip.map(i => (
                  <EquipSelectButton key={i.equipment_id} item={i} onClick={() => handleAddEquipment(i)} disabled={selectedEquip.some(e => e.equipment_id === i.equipment_id) || !!(i.parent_equipment_id && selectedEquip.some(e => e.equipment_id === i.parent_equipment_id))} />
                ))
              )}
            </div>
            {selectedEquip.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                <p className="text-xs text-muted-foreground">الادوات المختارة:</p>
                  {selectedEquip.map(e => (
                  <SelectedEquipRow key={e.equipment_id} item={e} attachments={childrenMap.get(e.equipment_id) ?? []} onQuantityChange={handleQuantityChange} onRemove={handleRemoveEquipment} />
                ))}
              </div>
            )}
          </div>

          <label className="text-sm font-medium text-muted-foreground">
            ملاحظات
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm mt-1"
            />
          </label>

          <Button type="submit" disabled={loading || !classId || !receiverId || !pickupDatetime || !returnDatetime}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            إنشاء الحجز
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
