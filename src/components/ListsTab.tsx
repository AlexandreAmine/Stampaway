import { useState, useEffect } from "react";
import { Plus, X, ChevronRight, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { FavoritePicker } from "@/components/FavoritePicker";
import { toast } from "sonner";

interface ListWithItems {
  id: string;
  name: string;
  description: string | null;
  items: {
    id: string;
    place: { id: string; name: string; country: string; type: string; image: string | null };
  }[];
}

export function ListsTab() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [openList, setOpenList] = useState<ListWithItems | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<"city" | "country">("city");

  useEffect(() => {
    if (user) fetchLists();
  }, [user]);

  const fetchLists = async () => {
    if (!user) return;
    const { data: listsData } = await supabase
      .from("lists")
      .select("id, name, description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!listsData) { setLoading(false); return; }

    const enriched: ListWithItems[] = [];
    for (const list of listsData) {
      const { data: items } = await supabase
        .from("list_items")
        .select("id, places!inner(id, name, country, type, image)")
        .eq("list_id", list.id);

      enriched.push({
        ...list,
        items: (items || []).map((i: any) => ({
          id: i.id,
          place: { id: i.places.id, name: i.places.name, country: i.places.country, type: i.places.type, image: i.places.image },
        })),
      });
    }
    setLists(enriched);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("lists").insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
    });
    setCreating(false);
    if (error) { toast.error("Failed to create list"); return; }
    toast.success("List created!");
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
    fetchLists();
  };

  const handleDeleteList = async (listId: string) => {
    await supabase.from("list_items").delete().eq("list_id", listId);
    await supabase.from("lists").delete().eq("id", listId);
    toast.success("List deleted");
    setOpenList(null);
    fetchLists();
  };

  const handleAddToList = async (placeId: string) => {
    if (!openList) return;
    const exists = openList.items.some((i) => i.place.id === placeId);
    if (exists) { toast("Already in this list"); return; }
    const { error } = await supabase.from("list_items").insert({ list_id: openList.id, place_id: placeId });
    if (error) { toast.error("Failed to add"); return; }
    toast.success("Added to list!");
    fetchLists();
  };

  const handleRemoveItem = async (itemId: string) => {
    await supabase.from("list_items").delete().eq("id", itemId);
    toast.success("Removed from list");
    fetchLists();
  };

  // Sync openList with refreshed data
  useEffect(() => {
    if (openList) {
      const updated = lists.find((l) => l.id === openList.id);
      if (updated) setOpenList(updated);
    }
  }, [lists]);

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // List detail view
  if (openList) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setOpenList(null)} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
            <span className="text-sm text-muted-foreground">Back</span>
          </button>
          <button onClick={() => handleDeleteList(openList.id)} className="p-2">
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        </div>
        <h3 className="text-lg font-bold text-foreground">{openList.name}</h3>
        {openList.description && <p className="text-xs text-muted-foreground">{openList.description}</p>}

        <div className="flex gap-2">
          <button onClick={() => { setPickerType("city"); setPickerOpen(true); }} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium">+ Add City</button>
          <button onClick={() => { setPickerType("country"); setPickerOpen(true); }} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium">+ Add Country</button>
        </div>

        {openList.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No destinations in this list yet</p>
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
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="List name..."
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none font-semibold"
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={creating || !newName.trim()} className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">Create</button>
                <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground px-4 py-1.5">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {lists.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <p className="text-muted-foreground text-sm">No lists yet</p>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-primary text-sm font-medium">
            <Plus className="w-4 h-4" /> Create your first list
          </button>
        </div>
      ) : (
        <>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-primary text-sm font-medium">
              <Plus className="w-4 h-4" /> New list
            </button>
          )}
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setOpenList(list)}
              className="w-full bg-card rounded-xl p-4 border border-border text-left flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-bold text-foreground">{list.name}</p>
                <p className="text-xs text-muted-foreground">{list.items.length} destination{list.items.length !== 1 ? "s" : ""}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </>
      )}
    </motion.div>
  );
}
