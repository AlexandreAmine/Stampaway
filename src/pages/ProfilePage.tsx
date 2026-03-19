import { useState, useEffect, useCallback } from "react";
import { ChevronRight, LogOut, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RatingHistogram } from "@/components/RatingHistogram";
import { FavoritePicker } from "@/components/FavoritePicker";
import { DestinationPoster } from "@/components/DestinationPoster";
import { DiaryTab } from "@/components/DiaryTab";
import { ListsTab } from "@/components/ListsTab";
import { WishlistTab } from "@/components/WishlistTab";
import { supabase } from "@/integrations/supabase/client";

const profileTabs = ["Profile", "Diary", "Lists", "Wishlist"];

interface FavoriteSlot {
  slot_index: number;
  place_id: string;
  place_name: string;
  place_image: string | null;
  place_country: string;
  place_type: string;
}

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Profile");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<"city" | "country">("city");
  const [pickerSlot, setPickerSlot] = useState(0);

  const [favoriteCities, setFavoriteCities] = useState<(FavoriteSlot | null)[]>([null, null, null, null]);
  const [favoriteCountries, setFavoriteCountries] = useState<(FavoriteSlot | null)[]>([null, null, null, null]);

  const [countriesCount, setCountriesCount] = useState(0);
  const [citiesCount, setCitiesCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [listsCount, setListsCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  const [cityDistribution, setCityDistribution] = useState<number[]>(Array(10).fill(0));
  const [countryDistribution, setCountryDistribution] = useState<number[]>(Array(10).fill(0));

  const displayName = profile?.username || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3B82F6&color=fff`;

  const fetchData = useCallback(async () => {
    if (!user) return;
    const uid = user.id;

    const [favRes, reviewRes, listRes, wishRes, followingRes, followersRes] = await Promise.all([
      supabase.from("favorite_places").select("slot_index, place_id, type, places!inner(name, image, country, type)").eq("user_id", uid),
      supabase.from("reviews").select("rating, place_id, places!inner(type)").eq("user_id", uid),
      supabase.from("lists").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase.from("wishlists").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase.from("followers").select("id", { count: "exact", head: true }).eq("follower_id", uid),
      supabase.from("followers").select("id", { count: "exact", head: true }).eq("following_id", uid),
    ]);

    if (favRes.data) {
      const cities: (FavoriteSlot | null)[] = [null, null, null, null];
      const countries: (FavoriteSlot | null)[] = [null, null, null, null];
      favRes.data.forEach((f: any) => {
        const slot: FavoriteSlot = {
          slot_index: f.slot_index,
          place_id: f.place_id,
          place_name: f.places.name,
          place_image: f.places.image,
          place_country: f.places.country,
          place_type: f.places.type,
        };
        if (f.type === "city") cities[f.slot_index] = slot;
        else countries[f.slot_index] = slot;
      });
      setFavoriteCities(cities);
      setFavoriteCountries(countries);
    }

    if (reviewRes.data) {
      const cityRatings: number[] = [];
      const countryRatings: number[] = [];
      const uniqueCities = new Set<string>();
      const uniqueCountries = new Set<string>();

      reviewRes.data.forEach((r: any) => {
        if (r.places.type === "city") {
          cityRatings.push(Number(r.rating));
          uniqueCities.add(r.place_id);
        } else {
          countryRatings.push(Number(r.rating));
          uniqueCountries.add(r.place_id);
        }
      });

      setCitiesCount(uniqueCities.size);
      setCountriesCount(uniqueCountries.size);
      setReviewsCount(reviewRes.data.length);

      const buildDist = (ratings: number[]) => {
        const dist = Array(10).fill(0);
        ratings.forEach((r) => {
          const idx = Math.round(r * 2) - 1;
          if (idx >= 0 && idx < 10) dist[idx]++;
        });
        return dist;
      };
      setCityDistribution(buildDist(cityRatings));
      setCountryDistribution(buildDist(countryRatings));
    }

    setListsCount(listRes.count || 0);
    setWishlistCount(wishRes.count || 0);
    setFollowingCount(followingRes.count || 0);
    setFollowersCount(followersRes.count || 0);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenPicker = (type: "city" | "country", slot: number) => {
    setPickerType(type);
    setPickerSlot(slot);
    setPickerOpen(true);
  };

  const handleSelectFavorite = async (placeId: string, placeName: string, placeImage: string | null, placeCountry: string) => {
    if (!user) return;

    const existing = pickerType === "city" ? favoriteCities[pickerSlot] : favoriteCountries[pickerSlot];

    if (existing) {
      await supabase
        .from("favorite_places")
        .update({ place_id: placeId })
        .eq("user_id", user.id)
        .eq("slot_index", pickerSlot)
        .eq("type", pickerType);
    } else {
      await supabase.from("favorite_places").insert({
        user_id: user.id,
        place_id: placeId,
        slot_index: pickerSlot,
        type: pickerType,
      });
    }

    const newSlot: FavoriteSlot = {
      slot_index: pickerSlot,
      place_id: placeId,
      place_name: placeName,
      place_image: placeImage,
      place_country: placeCountry,
      place_type: pickerType,
    };
    if (pickerType === "city") {
      const updated = [...favoriteCities];
      updated[pickerSlot] = newSlot;
      setFavoriteCities(updated);
    } else {
      const updated = [...favoriteCountries];
      updated[pickerSlot] = newSlot;
      setFavoriteCountries(updated);
    }
  };

  const stats = [
    { label: "Countries", value: countriesCount, link: "/logged-places?type=country" },
    { label: "Cities", value: citiesCount, link: "/logged-places?type=city" },
    { label: "Reviews", value: reviewsCount, link: null },
    { label: "Lists", value: listsCount, link: null },
    { label: "Wishlist", value: wishlistCount, link: null },
    { label: "Following", value: followingCount, link: null },
    { label: "Followers", value: followersCount, link: null },
  ];

  const renderFavoriteSlots = (type: "city" | "country", favorites: (FavoriteSlot | null)[]) => (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
      {[0, 1, 2, 3].map((i) => {
        const fav = favorites[i];
        return fav ? (
          <button
            key={i}
            onClick={() => handleOpenPicker(type, i)}
            className="w-28 h-36 shrink-0"
          >
            <DestinationPoster
              placeId={fav.place_id}
              name={fav.place_name}
              country={fav.place_country}
              type={type}
              image={fav.place_image}
              autoGenerate
              className="w-full h-full"
            />
          </button>
        ) : (
          <button
            key={i}
            onClick={() => handleOpenPicker(type, i)}
            className="w-28 h-36 rounded-2xl border-2 border-dashed border-border flex items-center justify-center shrink-0 hover:border-primary transition-colors"
          >
            <Plus className="w-8 h-8 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-border"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <button onClick={signOut} className="p-2">
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-5 mb-6">
          {profileTabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="relative pb-2">
              <span className={`text-sm font-semibold transition-colors ${activeTab === tab ? "text-foreground" : "text-muted-foreground"}`}>
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div layoutId="profile-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "Profile" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Favorite Countries */}
            <div className="mb-4">
              <div className="flex items-center gap-1 mb-3">
                <h2 className="text-lg font-bold text-foreground">Favorite Countries</h2>
                <ChevronRight className="w-5 h-5 text-foreground" />
              </div>
              {renderFavoriteSlots("country", favoriteCountries)}
            </div>

            <div className="mb-6">
              <RatingHistogram distribution={countryDistribution} />
            </div>

            {/* Favorite Cities */}
            <div className="mb-4">
              <div className="flex items-center gap-1 mb-3">
                <h2 className="text-lg font-bold text-foreground">Favorite Cities</h2>
                <ChevronRight className="w-5 h-5 text-foreground" />
              </div>
              {renderFavoriteSlots("city", favoriteCities)}
            </div>

            <div className="mb-6">
              <RatingHistogram distribution={cityDistribution} />
            </div>

            {/* Stats list */}
            <div className="space-y-0">
              {stats.map((stat) => (
                <button
                  key={stat.label}
                  onClick={() => stat.link && navigate(stat.link)}
                  className="flex items-center justify-between py-3 border-b border-border w-full text-left"
                >
                  <span className="text-sm font-semibold text-foreground">{stat.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">{stat.value}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "Diary" && <DiaryTab />}

        {activeTab === "Lists" && <ListsTab />}

        {activeTab === "Wishlist" && <WishlistTab />}
      </div>

      <FavoritePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        type={pickerType}
        onSelect={handleSelectFavorite}
      />
    </div>
  );
}
