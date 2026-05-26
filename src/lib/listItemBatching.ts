import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;
const LIST_ID_CHUNK_SIZE = 100;

export type BatchedListItem = {
  id: string;
  position: number;
  place: {
    id: string;
    name: string;
    country: string;
    type: string;
    image: string | null;
  };
};

const dedupeListIds = (listIds: string[]) => [...new Set(listIds.filter(Boolean))];

const chunkListIds = (listIds: string[]) => {
  const ids = dedupeListIds(listIds);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += LIST_ID_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + LIST_ID_CHUNK_SIZE));
  }
  return chunks;
};

const createItemsMap = (listIds: string[]) => {
  const itemsByListId = new Map<string, BatchedListItem[]>();
  listIds.forEach((listId) => itemsByListId.set(listId, []));
  return itemsByListId;
};

const toListItem = (item: any): BatchedListItem | null => {
  const place = Array.isArray(item.places) ? item.places[0] : item.places;
  if (!place) return null;

  return {
    id: item.id,
    position: item.position || 0,
    place: {
      id: place.id,
      name: place.name,
      country: place.country,
      type: place.type,
      image: place.image,
    },
  };
};

const hasDuplicatePositions = (items: BatchedListItem[]) => {
  const seen = new Set<number>();
  for (const item of items) {
    if (seen.has(item.position)) return true;
    seen.add(item.position);
  }
  return false;
};

async function fetchSingleListItems(listId: string) {
  const { data: items } = await supabase
    .from("list_items")
    .select("id, position, places!inner(id, name, country, type, image)")
    .eq("list_id", listId)
    .order("position", { ascending: true });

  return (items || []).map(toListItem).filter(Boolean) as BatchedListItem[];
}

export async function fetchListItemsByListIdIndividually(listIds: string[]) {
  const ids = dedupeListIds(listIds);
  const itemsByListId = createItemsMap(ids);

  for (const listId of ids) {
    itemsByListId.set(listId, await fetchSingleListItems(listId));
  }

  return itemsByListId;
}

export async function fetchListItemsByListId(listIds: string[]) {
  const ids = dedupeListIds(listIds);
  const itemsByListId = createItemsMap(ids);

  for (const listIdChunk of chunkListIds(ids)) {
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("list_items")
        .select("id, list_id, position, places!inner(id, name, country, type, image)")
        .in("list_id", listIdChunk)
        .order("list_id", { ascending: true })
        .order("position", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((item: any) => {
        const listItem = toListItem(item);
        if (!listItem) return;
        itemsByListId.get(item.list_id)?.push(listItem);
      });

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  const listsWithDuplicatePositions = ids.filter((listId) =>
    hasDuplicatePositions(itemsByListId.get(listId) || [])
  );

  if (listsWithDuplicatePositions.length > 0) {
    const currentOrderItems = await fetchListItemsByListIdIndividually(listsWithDuplicatePositions);
    currentOrderItems.forEach((items, listId) => {
      itemsByListId.set(listId, items);
    });
  }

  return itemsByListId;
}
