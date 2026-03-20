import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { DestinationPoster } from "@/components/DestinationPoster";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function ListDetailPage() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [owner, setOwner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!listId) return;
    const fetch = async () => {
      const { data: listData } = await supabase.from("lists").select("id, name, description, user_id").eq("id", listId).single();
      if (!listData) { setLoading(false); return; }
      setList(listData);

      const { data: profile } = await supabase.from("profiles").select("user_id, username, profile_picture").eq("user_id", listData.user_id).single();
      setOwner(profile);

      const { data: itemsData } = await supabase
        .from("list_items")
        .select("id, places!inner(id, name, country, type, image)")
        .eq("list_id", listId);

      setItems((itemsData || []).map((i: any) => ({
        id: i.id,
        place: i.places,
      })));
      setLoading(false);
    };
    fetch();
  }, [listId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-background pt-12 px-5">
        <button onClick={() => navigate(-1)} className="mb-4"><ChevronLeft className="w-6 h-6 text-foreground" /></button>
        <p className="text-sm text-muted-foreground text-center">List not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{list.name}</h1>
        </div>

        {owner && (
          <button onClick={() => navigate(`/profile/${owner.user_id}`)} className="flex items-center gap-2 mb-4">
            <Avatar className="w-7 h-7">
              <AvatarImage src={owner.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.username)}&background=3B82F6&color=fff`} />
              <AvatarFallback>{owner.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{owner.username}</span>
          </button>
        )}

        {list.description && <p className="text-sm text-muted-foreground mb-5">{list.description}</p>}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No destinations in this list</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {items.map((item) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => navigate(`/place/${item.place.id}`)}
                className="aspect-[3/4] w-full"
              >
                <DestinationPoster
                  placeId={item.place.id}
                  name={item.place.name}
                  country={item.place.country}
                  type={item.place.type as "city" | "country"}
                  image={item.place.image}
                  className="w-full h-full"
                />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
