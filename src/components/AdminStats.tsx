import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PlatformStats {
  total_users: number;
  total_reviews: number;
  total_places: number;
  total_countries: number;
  total_cities: number;
  total_lists: number;
  total_wishlists: number;
}

export function AdminStats({ userId }: { userId: string }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      
      if (data) {
        setIsAdmin(true);
        const { data: statsData, error } = await supabase.rpc("get_platform_stats");
        if (!error && statsData) {
          setStats(statsData as unknown as PlatformStats);
        }
      }
      setLoading(false);
    };
    checkAdmin();
  }, [userId]);

  if (loading || !isAdmin || !stats) return null;

  const items = [
    { label: "Users", value: stats.total_users },
    { label: "Reviews", value: stats.total_reviews },
    { label: "Countries", value: stats.total_countries },
    { label: "Cities", value: stats.total_cities },
    { label: "Lists", value: stats.total_lists },
    { label: "Wishlists", value: stats.total_wishlists },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Platform Stats</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-card rounded-xl p-3 text-center border border-border"
          >
            <p className="text-lg font-bold text-foreground tabular-nums">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
