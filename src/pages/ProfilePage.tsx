import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, LogOut, Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RatingHistogram } from "@/components/RatingHistogram";
import { FavoritePicker } from "@/components/FavoritePicker";
import { DestinationPoster } from "@/components/DestinationPoster";
import { StarRating } from "@/components/StarRating";
import { DiaryTab } from "@/components/DiaryTab";
import { ListsTab } from "@/components/ListsTab";
import { WishlistTab } from "@/components/WishlistTab";
import { MapTab } from "@/components/MapTab";
import { LikesTab } from "@/components/LikesTab";
import { FollowingTab } from "@/components/FollowingTab";
import { FollowersTab } from "@/components/FollowersTab";
import { ReviewsTab } from "@/components/ReviewsTab";
import { LoggedPlacesInline } from "@/components/LoggedPlacesInline";
import { supabase } from "@/integrations/supabase/client";

interface FavoriteSlot {
  slot_index: number;
  place_id: string;
  place_name: string;
  place_image: string | null;
  place_country: string;
  place_type: string;
}

type SubPage = null | "Countries" | "Cities" | "Diary" | "Map" | "Lists" | "Wishlist" | "Likes" | "Reviews" | "Following" | "Followers" | "CountriesByRating" | "CitiesByRating";

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();

  // Determine if viewing own profile or another user's
  const viewingUserId = paramUserId || user?.id;
  const isOwnProfile = !paramUserId || paramUserId === user?.id;

  const [viewedProfile, setViewedProfile] = useState<{ username: string; profile_picture: string | null } | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<"city" | "country">("city");
  const [pickerSlot, setPickerSlot] = useState(0);

  const [favoriteCities, setFavoriteCities] = useState<(FavoriteSlot | null)[]>([null, null, null, null]);
  const [favoriteCountries, setFavoriteCountries] = useState<(FavoriteSlot | null)[]>([null, null, null, null]);

  const [countriesCount, setCountriesCount] = useState(0);
  const [citiesCount, setCitiesCount] = useState(0);
  const [totalCountries, setTotalCountries] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [listsCount, setListsCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [writtenReviewsCount, setWrittenReviewsCount] = useState(0);

  const [cityDistribution, setCityDistribution] = useState<number[]>(Array(10).fill(0));
  const [countryDistribution, setCountryDistribution] = useState<number[]>(Array(10).fill(0));

  const [subPage, setSubPage] = useState<SubPage>(null);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);

  // Fetch viewed user's profile if not own
  useEffect(() => {
    if (isOwnProfile) {
      setViewedProfile(null);
    } else if (viewingUserId) {
      supabase.from("profiles").select("username, profile_picture").eq("user_id", viewingUserId).single().then(({ data }) => {
        if (data) setViewedProfile(data);
      });
    }
  }, [viewingUserId, isOwnProfile]);

  const currentProfile = isOwnProfile ? profile : viewedProfile;
  const displayName = currentProfile?.username || "User";
  const avatarUrl = currentProfile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3B82F6&color=fff`;

  const fetchData = useCallback(async () => {
    if (!viewingUserId) return;
    const uid = viewingUserId;

    const [favRes, reviewRes, listRes, wishRes, followingRes, followersRes, totalCountriesRes, likesRes, writtenReviewsRes] = await Promise.all([
      supabase.from("favorite_places").select("slot_index, place_id, type, places!inner(name, image, country, type)").eq("user_id", uid),
      supabase.from("reviews").select("rating, place_id, places!inner(type)").eq("user_id", uid),
      supabase.from("lists").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase.from("wishlists").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase.from("followers").select("id", { count: "exact", head: true }).eq("follower_id", uid),
      supabase.from("followers").select("id", { count: "exact", head: true }).eq("following_id", uid),
      supabase.from("places").select("id", { count: "exact", head: true }).eq("type", "country"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("liked", true),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", uid).not("review_text", "is", null).neq("review_text", ""),
    ]);

    if (favRes.data) {
      const cities: (FavoriteSlot | null)[] = [null, null, null, null];
      const countries: (FavoriteSlot | null)[] = [null, null, null, null];
      favRes.data.forEach((f: any) => {
        const slot: FavoriteSlot = {
          slot_index: f.slot_index, place_id: f.place_id,
          place_name: f.places.name, place_image: f.places.image,
          place_country: f.places.country, place_type: f.places.type,
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
    setTotalCountries(totalCountriesRes.count || 0);
    setLikesCount(likesRes.count || 0);
    setWrittenReviewsCount(writtenReviewsRes.count || 0);
  }, [viewingUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenPicker = (type: "city" | "country", slot: number) => {
    setPickerType(type);
    setPickerSlot(slot);
    setPickerOpen(true);
  };

  const handleSelectFavorite = async (placeId: string, placeName: string, placeImage: string | null, placeCountry: string) => {
    if (!user) return;
    const existing = pickerType === "city" ? favoriteCities[pickerSlot] : favoriteCountries[pickerSlot];
    if (existing) {
      await supabase.from("favorite_places").update({ place_id: placeId }).eq("user_id", user.id).eq("slot_index", pickerSlot).eq("type", pickerType);
    } else {
      await supabase.from("favorite_places").insert({ user_id: user.id, place_id: placeId, slot_index: pickerSlot, type: pickerType });
    }
    const newSlot: FavoriteSlot = { slot_index: pickerSlot, place_id: placeId, place_name: placeName, place_image: placeImage, place_country: placeCountry, place_type: pickerType };
    if (pickerType === "city") {
      const updated = [...favoriteCities]; updated[pickerSlot] = newSlot; setFavoriteCities(updated);
    } else {
      const updated = [...favoriteCountries]; updated[pickerSlot] = newSlot; setFavoriteCountries(updated);
    }
  };

  const stats: { label: string; value: string; subPage: SubPage }[] = [
    { label: "Countries", value: `${countriesCount} / ${totalCountries}`, subPage: "Countries" },
    { label: "Cities", value: `${citiesCount}`, subPage: "Cities" },
    { label: "Diary", value: "", subPage: "Diary" },
    { label: "Map", value: "", subPage: "Map" },
    { label: "Lists", value: `${listsCount}`, subPage: "Lists" },
    { label: "Wishlist", value: `${wishlistCount}`, subPage: "Wishlist" },
    { label: "Likes", value: `${likesCount}`, subPage: "Likes" },
    { label: "Reviews", value: `${writtenReviewsCount}`, subPage: "Reviews" },
    { label: "Following", value: `${followingCount}`, subPage: "Following" },
    { label: "Followers", value: `${followersCount}`, subPage: "Followers" },
  ];

  const handleRemoveFavorite = async (type: "city" | "country", slotIndex: number) => {
    if (!user) return;
    await supabase.from("favorite_places").delete().eq("user_id", user.id).eq("slot_index", slotIndex).eq("type", type);
    if (type === "city") {
      const updated = [...favoriteCities]; updated[slotIndex] = null; setFavoriteCities(updated);
    } else {
      const updated = [...favoriteCountries]; updated[slotIndex] = null; setFavoriteCountries(updated);
    }
  };

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragType, setDragType] = useState<"city" | "country" | null>(null);

  const handleDragStart = (type: "city" | "country", index: number) => {
    setDragIndex(index);
    setDragType(type);
  };

  const handleDrop = async (type: "city" | "country", targetIndex: number) => {
    if (dragIndex === null || dragType !== type || dragIndex === targetIndex || !user) return;
    const favorites = type === "city" ? [...favoriteCities] : [...favoriteCountries];
    const setFavorites = type === "city" ? setFavoriteCities : setFavoriteCountries;

    const srcItem = favorites[dragIndex];
    const destItem = favorites[targetIndex];

    // Swap in state
    favorites[targetIndex] = srcItem ? { ...srcItem, slot_index: targetIndex } : null;
    favorites[dragIndex] = destItem ? { ...destItem, slot_index: dragIndex } : null;
    setFavorites(favorites);

    // Update DB
    if (srcItem && destItem) {
      await supabase.from("favorite_places").update({ slot_index: 99 }).eq("user_id", user.id).eq("slot_index", targetIndex).eq("type", type);
      await supabase.from("favorite_places").update({ slot_index: targetIndex }).eq("user_id", user.id).eq("slot_index", dragIndex).eq("type", type);
      await supabase.from("favorite_places").update({ slot_index: dragIndex }).eq("user_id", user.id).eq("slot_index", 99).eq("type", type);
    } else if (srcItem) {
      await supabase.from("favorite_places").update({ slot_index: targetIndex }).eq("user_id", user.id).eq("slot_index", dragIndex).eq("type", type);
    }

    setDragIndex(null);
    setDragType(null);
  };

  const renderFavoriteSlots = (type: "city" | "country", favorites: (FavoriteSlot | null)[]) => (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
      {[0, 1, 2, 3].map((i) => {
        const fav = favorites[i];
        return fav ? (
          <div
            key={i}
            className="relative w-28 h-36 shrink-0"
            draggable={isOwnProfile}
            onDragStart={() => handleDragStart(type, i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(type, i)}
          >
            <button onClick={() => navigate(`/place/${fav.place_id}`)} className="w-full h-full">
              <DestinationPoster placeId={fav.place_id} name={fav.place_name} country={fav.place_country} type={type} image={fav.place_image} autoGenerate className="w-full h-full" />
            </button>
            {isOwnProfile && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveFavorite(type, i); }}
                className="absolute top-1 left-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center z-10"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        ) : isOwnProfile ? (
          <button
            key={i}
            onClick={() => handleOpenPicker(type, i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(type, i)}
            className="w-28 h-36 rounded-2xl border-2 border-dashed border-border flex items-center justify-center shrink-0 hover:border-primary transition-colors"
          >
            <Plus className="w-8 h-8 text-muted-foreground" />
          </button>
        ) : null;
      })}
    </div>
  );

  const renderSubPage = () => {
    const uid = viewingUserId;
    switch (subPage) {
      case "Countries":
      case "CountriesByRating":
        return <LoggedPlacesInline type="country" userId={uid} ratingFilter={ratingFilter} />;
      case "Cities":
      case "CitiesByRating":
        return <LoggedPlacesInline type="city" userId={uid} ratingFilter={ratingFilter} />;
      case "Diary":
        return <DiaryTab userId={uid} />;
      case "Map":
        return <MapTab userId={uid} />;
      case "Lists":
        return <ListsTab userId={uid} readOnly={!isOwnProfile} />;
      case "Wishlist":
        return <WishlistTab userId={uid} readOnly={!isOwnProfile} />;
      case "Likes":
        return <LikesTab userId={uid} />;
      case "Reviews":
        return <ReviewsTab userId={uid} />;
      case "Following":
        return <FollowingTab userId={uid} readOnly={!isOwnProfile} />;
      case "Followers":
        return <FollowersTab userId={uid} />;
      default:
        return null;
    }
  };

  // Sub-page view
  if (subPage) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setSubPage(null); setRatingFilter(undefined); }}>
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">
              {subPage === "CountriesByRating" ? `Countries · ${ratingFilter}★` : subPage === "CitiesByRating" ? `Cities · ${ratingFilter}★` : subPage}
            </h1>
          </div>
          {renderSubPage()}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isOwnProfile && (
              <button onClick={() => navigate(-1)} className="mr-1">
                <ChevronLeft className="w-6 h-6 text-foreground" />
              </button>
            )}
            <img src={avatarUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover border-2 border-border" />
            <div>
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
              {isOwnProfile && <p className="text-xs text-muted-foreground">{user?.email}</p>}
            </div>
          </div>
          {isOwnProfile && (
            <button onClick={signOut} className="p-2">
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Favorite Countries */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-3">
            <h2 className="text-lg font-bold text-foreground">Favorite Countries</h2>
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
          {renderFavoriteSlots("country", favoriteCountries)}
        </div>
        <div className="mb-6"><RatingHistogram distribution={countryDistribution} onBarClick={(r) => { setRatingFilter(r); setSubPage("CountriesByRating"); }} /></div>

        {/* Favorite Cities */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-3">
            <h2 className="text-lg font-bold text-foreground">Favorite Cities</h2>
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
          {renderFavoriteSlots("city", favoriteCities)}
        </div>
        <div className="mb-6"><RatingHistogram distribution={cityDistribution} onBarClick={(r) => { setRatingFilter(r); setSubPage("CitiesByRating"); }} /></div>

        {/* Stats / Navigation list */}
        <div className="space-y-0">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={() => setSubPage(stat.subPage)}
              className="flex items-center justify-between py-3 border-b border-border w-full text-left"
            >
              <span className="text-sm font-semibold text-foreground">{stat.label}</span>
              <div className="flex items-center gap-1">
                {stat.value && <span className="text-sm text-muted-foreground">{stat.value}</span>}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {isOwnProfile && <FavoritePicker open={pickerOpen} onClose={() => setPickerOpen(false)} type={pickerType} onSelect={handleSelectFavorite} />}
    </div>
  );
}
