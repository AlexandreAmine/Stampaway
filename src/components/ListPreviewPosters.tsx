import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DestinationPoster } from "@/components/DestinationPoster";

interface ListPreviewPostersProps {
  listId: string;
  maxItems?: number;
}

export function ListPreviewPosters({ listId, maxItems = 8 }: ListPreviewPostersProps) {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("list_items")
      .select("id, position, places!inner(id, name, country, type, image)")
      .eq("list_id", listId)
      .order("position", { ascending: true })
      .limit(maxItems)
      .then(({ data }) => {
        setItems((data || []).map((i: any) => i.places));
      });
  }, [listId, maxItems]);

  if (items.length === 0) return null;

  return (
    <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-hide">
      {items.map((place) => (
        <div key={place.id} className="w-10 h-14 shrink-0 rounded-md overflow-hidden">
          <DestinationPoster
            placeId={place.id}
            name={place.name}
            country={place.country}
            type={place.type as "city" | "country"}
            image={place.image}
            className="w-full h-full"
          />
        </div>
      ))}
    </div>
  );
}
