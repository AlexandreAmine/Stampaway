import { useState, useEffect } from "react";
import { DestinationPoster } from "@/components/DestinationPoster";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchListPreviewPosters,
  getCachedListPreviewPosters,
  getListPreviewPostersRequestToken,
  isListPreviewPostersRequestTokenCurrent,
  subscribeListPreviewPostersCache,
  syncListPreviewPostersCacheUser,
  type ListPreviewPosterPlace,
} from "@/lib/listPreviewPostersCache";

interface ListPreviewPostersProps {
  listId: string;
  maxItems?: number;
}

export function ListPreviewPosters({ listId, maxItems = 8 }: ListPreviewPostersProps) {
  const { user } = useAuth();
  const cacheUserId = user?.id ?? null;
  const renderKey = `${cacheUserId ?? "anonymous"}:${listId}:${maxItems}`;
  const [cacheNotificationVersion, setCacheNotificationVersion] = useState(0);
  const [itemsState, setItemsState] = useState<{
    renderKey: string;
    items: ListPreviewPosterPlace[];
  }>({ renderKey: "", items: [] });

  useEffect(() => {
    return subscribeListPreviewPostersCache(listId, setCacheNotificationVersion);
  }, [listId]);

  useEffect(() => {
    let cancelled = false;
    syncListPreviewPostersCacheUser(cacheUserId);

    const cached = getCachedListPreviewPosters(cacheUserId, listId, maxItems);
    if (cached) {
      setItemsState({ renderKey, items: cached });
      return () => {
        cancelled = true;
      };
    }

    setItemsState((current) =>
      current.renderKey === renderKey ? current : { renderKey, items: [] }
    );

    const token = getListPreviewPostersRequestToken(cacheUserId, listId);

    fetchListPreviewPosters(cacheUserId, listId, maxItems, token)
      .then((nextItems) => {
        if (
          !cancelled &&
          isListPreviewPostersRequestTokenCurrent(cacheUserId, listId, token)
        ) {
          setItemsState({ renderKey, items: nextItems });
        }
      })
      .catch((error) => {
        console.error("Error fetching list preview posters:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheUserId, listId, maxItems, renderKey, cacheNotificationVersion]);

  const items = itemsState.renderKey === renderKey ? itemsState.items : [];

  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
      {items.map((place) => (
        <div key={place.id} className="w-16 h-[88px] shrink-0 rounded-lg overflow-hidden">
          <DestinationPoster
            placeId={place.id}
            name={place.name}
            country={place.country}
            type={place.type as "city" | "country"}
            image={place.image}
            autoGenerate
            className="w-full h-full"
          />
        </div>
      ))}
    </div>
  );
}
