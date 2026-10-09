import { useState, useEffect, useRef } from "react";
import { EmptyState } from "@/components/EmptyState";
import { buttonVariants } from "@/components/ui/button";
import { hapticMedium, hapticSuccess } from "@/lib/haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, ChevronRight, Trash2, GripVertical, List as ListIcon } from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { FavoritePicker } from "@/components/FavoritePicker";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";
import { invalidateListPreviewPostersCache } from "@/lib/listPreviewPostersCache";
import {
  fetchListItemsByListId,
  fetchListItemsByListIdIndividually,
} from "@/lib/listItemBatching";

interface ListItem {
  id: string;
  position: number;
  place: { id: string; name: string; country: string; type: string; image: string | null };
}

interface ListWithItems {
  id: string;
  name: string;
  description: string | null;
  items: ListItem[];
}

export function ListsTab({ userId, readOnly = false }: { userId?: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const { t, tn } = useLanguage();
  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const targetUserId = userId || user?.id;
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [openList, setOpenList] = useState<ListWithItems | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<"city" | "country">("city");

  // Cached by React Query for instant tab reopening; lists stay in local
  // state (synced from the query below) because drag-reorder mutates them
  // optimistically.
  const listsQuery = useQuery({
    queryKey: ["profile-lists", targetUserId ?? null],
    enabled: !!targetUserId,
    queryFn: async (): Promise<ListWithItems[]> => {
      const { data: listsData } = await supabase
        .from("lists")
        .select("id, name, description")
        .eq("user_id", targetUserId!)
        .order("created_at", { ascending: false });

      if (!listsData) return [];

      const listIds = listsData.map((list) => list.id);
      let itemsByListId = new Map<string, ListItem[]>();
      if (listIds.length > 0) {
        try {
          itemsByListId = await fetchListItemsByListId(listIds);
        } catch (error) {
          console.error("Failed to fetch batched list items:", error);
          itemsByListId = await fetchListItemsByListIdIndividually(listIds);
        }
      }

      return listsData.map((list) => ({
        ...list,
        items: itemsByListId.get(list.id) || [],
      }));
    },
  });
  const loading = listsQuery.isPending;

  useEffect(() => {
    if (listsQuery.data) setLists(listsQuery.data);
  }, [listsQuery.data]);

  const fetchLists = () =>
    queryClient.invalidateQueries({ queryKey: ["profile-lists", targetUserId ?? null] });

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("lists").insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
    });
    setCreating(false);
    if (error) { toastError(t("lists.createFailed")); return; }
    invalidateOwnProfileContentCache(user.id);
    hapticSuccess();
    toast.success(t("lists.created"));
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
    fetchLists();
  };

  const handleDeleteList = async (listId: string) => {
    const { error: itemsError } = await supabase.from("list_items").delete().eq("list_id", listId);
    if (!itemsError) invalidateListPreviewPostersCache(listId);

    const { error } = await supabase.from("lists").delete().eq("id", listId);
    if (error) { toastError(t("lists.deleteFailed")); return; }
    if (user?.id) {
      invalidateOwnProfileContentCache(user.id);
      invalidateListPreviewPostersCache(listId);
    }
    toast.success(t("lists.deleted"));
    setOpenList(null);
    fetchLists();
  };

  const handleAddToList = async (placeId: string) => {
    if (!openList) return;
    const exists = openList.items.some((i) => i.place.id === placeId);
    if (exists) { toast(t("toast.alreadyInList")); return; }
    const maxPos = openList.items.reduce((max, i) => Math.max(max, i.position), -1);
    const { error } = await supabase.from("list_items").insert({ list_id: openList.id, place_id: placeId, position: maxPos + 1 });
    if (error) { toastError(t("common.failedToAdd")); return; }
    invalidateListPreviewPostersCache(openList.id);
    toast.success(t("toast.addedToList"));
    fetchLists();
  };

  const handleRemoveItem = async (itemId: string) => {
    const listId = openList?.id;
    const { error } = await supabase.from("list_items").delete().eq("id", itemId);
    if (error) { toastError(t("common.failedToRemove")); return; }
    invalidateListPreviewPostersCache(listId);
    toast.success(t("lists.removed"));
    fetchLists();
  };

  const handleReorder = async (newItems: ListItem[]) => {
    if (!openList) return;
    const previous = openList;
    const updated = { ...openList, items: newItems };
    setOpenList(updated);
    // Update positions in DB — all changed rows in parallel instead of one
    // sequential round-trip per item (a 30-item reorder was ~30 round-trips)
    const changed = newItems
      .map((item, i) => ({ item, position: i }))
      .filter(({ item, position }) => item.position !== position);
    if (changed.length === 0) return;

    const results = await Promise.all(
      changed.map(({ item, position }) =>
        supabase.from("list_items").update({ position }).eq("id", item.id)
      )
    );
    if (results.some((r) => r.error)) {
      // Some writes may have landed, so the DB order is now unknown — revert the
      // optimistic state and re-read rather than leaving the UI showing an order
      // that was never saved.
      setOpenList(previous);
      toastError(t("lists.reorderFailed"));
      fetchLists();
      return;
    }
    invalidateListPreviewPostersCache(previous.id);
  };

  // Sync openList with refreshed data
  useEffect(() => {
    if (openList) {
      const updated = lists.find((l) => l.id === openList.id);
      if (updated) setOpenList(updated);
    }
  }, [lists]);

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-muted/40 rounded-xl skeleton-shimmer" />
        ))}
      </div>
    );
  }

  // List detail view
  if (openList) {
    return (
      <motion.div initial={false} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setOpenList(null)} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
            <span className="text-sm text-muted-foreground">{t("back")}</span>
          </button>
          {!readOnly && (
            <button onClick={() => handleDeleteList(openList.id)} className="p-2">
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          )}
        </div>
        <h3 className="section-title" data-no-translate>{openList.name}</h3>
        {openList.description && <p className="text-xs text-muted-foreground">{openList.description}</p>}

        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={() => { setPickerType("city"); setPickerOpen(true); }} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium">+ {t("lists.addCity")}</button>
            <button onClick={() => { setPickerType("country"); setPickerOpen(true); }} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium">+ {t("lists.addCountry")}</button>
          </div>
        )}

        {openList.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("lists.emptyYet")}</p>
        ) : !readOnly ? (
          <Reorder.Group axis="y" values={openList.items} onReorder={handleReorder} className="space-y-2">
            {openList.items.map((item) => (
              <Reorder.Item key={item.id} value={item} onDragEnd={hapticMedium} className="flex items-center gap-2 bg-card rounded-xl border border-border p-2">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden">
                  <DestinationPoster
                    placeId={item.place.id}
                    name={item.place.name}
                    country={item.place.country}
                    type={item.place.type as "city" | "country"}
                    image={item.place.image}
                    className="w-full h-full"
                  />
                </div>
                <p className="text-sm font-semibold text-foreground flex-1 truncate">{item.place.name}</p>
                <button aria-label={t("common.remove")}
                  onClick={() => handleRemoveItem(item.id)}
                  className="w-6 h-6 flex items-center justify-center shrink-0"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {openList.items.map((item) => (
              <div key={item.id} className="relative aspect-[3/4]">
                <DestinationPoster
                  placeId={item.place.id}
                  name={item.place.name}
                  country={item.place.country}
                  type={item.place.type as "city" | "country"}
                  image={item.place.image}
                  className="w-full h-full"
                />
              </div>
            ))}
          </div>
        )}

        <FavoritePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          type={pickerType}
          onSelect={(placeId) => { handleAddToList(placeId); setPickerOpen(false); }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} className="space-y-4">
      {!readOnly && (
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("lists.namePlaceholder")}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none font-semibold"
                />
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t("lists.description")}
                  className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={creating || !newName.trim()} className={buttonVariants({ size: "sm" })}>{t("common.create")}</button>
                  <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground px-4 py-1.5">{t("cancel")}</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {lists.length === 0 && !showCreate ? (
        <EmptyState
          icon={ListIcon}
          title={readOnly ? t("lists.noLists") : t("lists.createFirst")}
          body={readOnly ? undefined : t("empty.listsBody")}
          action={readOnly ? undefined : { label: t("lists.new"), onClick: () => setShowCreate(true) }}
        />
      ) : (
        <>
          {!readOnly && !showCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-primary text-sm font-medium">
              <Plus className="w-4 h-4" /> {t("lists.new")}
            </button>
          )}
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setOpenList(list)}
              className="w-full bg-card rounded-xl p-4 border border-border text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground" data-no-translate>{list.name}</p>
                  <p className="text-xs text-muted-foreground">{tn("count.destination", list.items.length)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              {list.items.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
                  {list.items.slice(0, 8).map((item) => (
                    <div key={item.id} className="w-16 h-[88px] shrink-0 rounded-lg overflow-hidden">
                      <DestinationPoster
                        placeId={item.place.id}
                        name={item.place.name}
                        country={item.place.country}
                        type={item.place.type as "city" | "country"}
                        image={item.place.image}
                        autoGenerate
                        className="w-full h-full"
                      />
                    </div>
                  ))}
                </div>
              )}
            </button>
          ))}
        </>
      )}
    </motion.div>
  );
}
