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
