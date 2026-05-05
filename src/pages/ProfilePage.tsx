import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, Settings, Plus, X, UserPlus, UserMinus, Pencil, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { RatingHistogram } from "@/components/RatingHistogram";
import { FavoritePicker } from "@/components/FavoritePicker";
import { DestinationPoster } from "@/components/DestinationPoster";
import { StarRating } from "@/components/StarRating";
import { DiaryTab } from "@/components/DiaryTab";
import { ListsTab } from "@/components/ListsTab";
import { WishlistTab } from "@/components/WishlistTab";
import { MapTab, SoloMapChart, CompareMapChart, fetchUserMapData } from "@/components/MapTab";
import type { UserMapData } from "@/components/MapTab";
import { LikesTab } from "@/components/LikesTab";
import { TagsTab } from "@/components/TagsTab";
import { FollowingTab } from "@/components/FollowingTab";
import { FollowersTab } from "@/components/FollowersTab";
import { ReviewsTab } from "@/components/ReviewsTab";
import { YearlyGoalsTab } from "@/components/YearlyGoalsTab";
import { LoggedPlacesInline } from "@/components/LoggedPlacesInline";
import { supabase } from "@/integrations/supabase/client";
import { AdminStats } from "@/components/AdminStats";
import { ProfileEditSheet } from "@/components/ProfileEditSheet";
import { ShareProfileSheet } from "@/components/ShareProfileSheet";
import { getFlagEmoji } from "@/lib/countryFlags";
import { RichBio } from "@/components/RichBio";
import { SocialLinks } from "@/components/SocialLinks";
import { sanitizeSocialLinks } from "@/lib/socialLinks";
import { Camera } from "lucide-react";
import { toast } from "sonner";

interface FavoriteSlot {
  slot_index: number;
  place_id: string;
  place_name: string;
  place_image: string | null;
  place_country: string;
  place_type: string;
}

type SubPage = null | "Countries" | "Cities" | "Diary" | "Map" | "Lists" | "Wishlist" | "Likes" | "Tags" | "Reviews" | "YearlyGoals" | "Following" | "Followers" | "CountriesByRating" | "CitiesByRating";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const subPageLabels: Record<string, string> = {
    Countries: t("profile.countries"), Cities: t("profile.cities"), Diary: t("profile.diary"),
    Reviews: t("profile.reviews"), Lists: t("profile.lists"), Map: t("profile.map"),
    Wishlist: t("profile.wishlist"), Likes: t("profile.likes"), Tags: t("profile.tags"),
    Following: t("profile.following"), Followers: t("profile.followers"), YearlyGoals: t("profile.yearlyGoals"),
  };
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();

  // Determine if viewing own profile or another user's
  const viewingUserId = paramUserId || user?.id;
  const isOwnProfile = !paramUserId || paramUserId === user?.id;

  const [viewedProfile, setViewedProfile] = useState<{ username: string; profile_picture: string | null; bio: string | null; country: string | null; is_private?: boolean; social_links?: any } | null>(null);
  const [ownProfileFull, setOwnProfileFull] = useState<{ username: string; profile_picture: string | null; bio: string | null; country: string | null; social_links?: any } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

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
  const [mapMyData, setMapMyData] = useState<UserMapData | null>(null);
  const [mapTheirData, setMapTheirData] = useState<UserMapData | null>(null);

  const [cityDistribution, setCityDistribution] = useState<number[]>(Array(10).fill(0));
  const [countryDistribution, setCountryDistribution] = useState<number[]>(Array(10).fill(0));

  const [subPage, setSubPage] = useState<SubPage>(null);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);

  // Reset subpage and fetch profile when navigating to a different user
  useEffect(() => {
    setSubPage(null);
    setRatingFilter(undefined);
    setIsBlocked(false);
    setHasPendingRequest(false);
    if (isOwnProfile && viewingUserId) {
      supabase.from("profiles").select("username, profile_picture, bio, country, social_links").eq("user_id", viewingUserId).single().then(({ data }) => {
        if (data) setOwnProfileFull(data as any);
      });
      setViewedProfile(null);
    } else if (viewingUserId) {
      supabase.from("profiles").select("username, profile_picture, bio, country, is_private, social_links").eq("user_id", viewingUserId).single().then(({ data }) => {
        if (data) setViewedProfile(data as any);
      });
      // Check if blocked
      if (user) {
        supabase.from("blocked_users").select("id").or(`and(blocker_id.eq.${user.id},blocked_id.eq.${viewingUserId}),and(blocker_id.eq.${viewingUserId},blocked_id.eq.${user.id})`).then(({ data }) => {
          setIsBlocked((data || []).length > 0);
        });
      }
    }
  }, [viewingUserId, isOwnProfile, user]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);

  // Check follow status + pending request
  useEffect(() => {
    if (!user || isOwnProfile || !viewingUserId) return;
    supabase.from("followers").select("id").eq("follower_id", user.id).eq("following_id", viewingUserId).maybeSingle().then(({ data }) => {
      setIsFollowing(!!data);
    });
    supabase.from("follow_requests").select("id").eq("requester_id", user.id).eq("target_id", viewingUserId).maybeSingle().then(({ data }) => {
      setHasPendingRequest(!!data);
    });
  }, [user, viewingUserId, isOwnProfile]);

  const toggleFollow = async () => {
    if (!user || !viewingUserId || togglingFollow) return;
    setTogglingFollow(true);
    if (isFollowing) {
      await supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", viewingUserId);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else if (hasPendingRequest) {
      // Cancel request
      await supabase.from("follow_requests").delete().eq("requester_id", user.id).eq("target_id", viewingUserId);
      setHasPendingRequest(false);
    } else {
      // Check if target is private
      const isTargetPrivate = viewedProfile?.is_private;
      if (isTargetPrivate) {
        await supabase.from("follow_requests").insert({ requester_id: user.id, target_id: viewingUserId });
        setHasPendingRequest(true);
      } else {
        await supabase.from("followers").insert({ follower_id: user.id, following_id: viewingUserId });
        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
      }
    }
    setTogglingFollow(false);
  };

  const currentProfile = isOwnProfile ? (ownProfileFull || profile) : viewedProfile;
  const displayName = currentProfile?.username || "User";
  const avatarUrl = currentProfile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3B82F6&color=fff`;
  const profileBio = (currentProfile as any)?.bio as string | null;
  const profileCountry = (currentProfile as any)?.country as string | null;
  const countryList = profileCountry ? profileCountry.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  const handleProfileSaved = () => {
    if (viewingUserId) {
      supabase.from("profiles").select("username, profile_picture, bio, country, social_links").eq("user_id", viewingUserId).single().then(({ data }) => {
        if (data) setOwnProfileFull(data as any);
      });
    }
  };

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

    // Fetch map data
    if (!isOwnProfile && user?.id && viewingUserId) {
      const [mine, theirs] = await Promise.all([
        fetchUserMapData(user.id),
        fetchUserMapData(viewingUserId),
      ]);
      setMapMyData(mine);
      setMapTheirData(theirs);
    } else if (viewingUserId) {
      const mapData = await fetchUserMapData(viewingUserId);
      setMapMyData(mapData);
      setMapTheirData(null);
    }
  }, [viewingUserId, isOwnProfile, user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenPicker = async (type: "city" | "country", slot: number) => {
    // Open picker inline to select place, then check if already logged
    setPickerType(type);
    setPickerSlot(slot);
    setPickerOpen(true);
  };

  const handleFavoriteSelected = async (placeId: string, placeName: string, placeImage: string | null, placeCountry: string) => {
    if (!user) return;
    // Check if user already logged this destination
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("place_id", placeId)
      .limit(1);

    if (existingReview && existingReview.length > 0) {
      // Already logged — just save as favorite directly
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
      toast.success("Favorite saved!");
    } else {
      // Not yet logged — redirect directly to logging form with place pre-selected
      setPickerOpen(false);
      navigate(`/add?favoriteType=${pickerType}&favoriteSlot=${pickerSlot}&placeId=${placeId}&placeName=${encodeURIComponent(placeName)}&placeCountry=${encodeURIComponent(placeCountry)}&placeImage=${encodeURIComponent(placeImage || "")}`);
    }
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
    { label: t("profile.countries"), value: `${countriesCount} / ${totalCountries}`, subPage: "Countries" },
    { label: t("profile.cities"), value: `${citiesCount}`, subPage: "Cities" },
    { label: t("profile.diary"), value: "", subPage: "Diary" },
    
    { label: t("profile.lists"), value: `${listsCount}`, subPage: "Lists" },
    { label: t("profile.wishlist"), value: `${wishlistCount}`, subPage: "Wishlist" },
    { label: t("profile.likes"), value: `${likesCount}`, subPage: "Likes" },
    { label: t("profile.tags"), value: "", subPage: "Tags" },
    { label: t("profile.reviews"), value: `${writtenReviewsCount}`, subPage: "Reviews" },
    { label: t("profile.yearlyGoals"), value: "", subPage: "YearlyGoals" },
  ];

  // Whether the viewer can open the followers/following lists.
  // Always true on own profile; on others' profiles, blocked by privacy unless following.
  const canOpenFollowLists = isOwnProfile || (!isBlocked && (!viewedProfile?.is_private || isFollowing));
  const handleOpenFollowList = (target: "Following" | "Followers") => {
    if (!canOpenFollowLists) {
      toast("Follow this account to see their list");
      return;
    }
    setSubPage(target);
  };

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
    <div className="grid grid-cols-4 gap-2">
      {[0, 1, 2, 3].map((i) => {
        const fav = favorites[i];
        return fav ? (
          <div
            key={i}
            className="relative w-full aspect-[3/4]"
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
            className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-border flex items-center justify-center hover:border-primary transition-colors"
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
        return <LoggedPlacesInline type="country" userId={uid} ratingFilter={ratingFilter} profileUsername={!isOwnProfile ? displayName : undefined} />;
      case "Cities":
      case "CitiesByRating":
        return <LoggedPlacesInline type="city" userId={uid} ratingFilter={ratingFilter} profileUsername={!isOwnProfile ? displayName : undefined} />;
      case "Diary":
        return <DiaryTab userId={uid} />;
      case "Map":
        return <MapTab userId={uid} />;
      case "Lists":
        return <ListsTab userId={uid} readOnly={!isOwnProfile} />;
      case "Wishlist":
        return <WishlistTab userId={uid} readOnly={!isOwnProfile} />;
      case "Likes":
        return <LikesTab userId={uid} profileUsername={!isOwnProfile ? displayName : undefined} />;
      case "Tags":
        return <TagsTab userId={uid} />;
      case "Reviews":
        return <ReviewsTab userId={uid} />;
      case "YearlyGoals":
        return <YearlyGoalsTab userId={uid} />;
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
              {subPage === "CountriesByRating" ? `Countries · ${ratingFilter}★` : subPage === "CitiesByRating" ? `Cities · ${ratingFilter}★` : (subPageLabels[subPage] || subPage)}
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
            <div className="relative">
              <img src={avatarUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover border-2 border-border" />
              {isOwnProfile && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    
                    id="profile-pic-input"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !user) return;
                      const ext = file.name.split('.').pop() || 'jpg';
                      const path = `${user.id}/avatar.${ext}`;
                      const { error: uploadErr } = await supabase.storage.from('profile-pictures').upload(path, file, { upsert: true });
                      if (uploadErr) { toast.error("Upload failed"); return; }
                      const { data: urlData } = supabase.storage.from('profile-pictures').getPublicUrl(path);
                      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
                      await supabase.from('profiles').update({ profile_picture: publicUrl }).eq('user_id', user.id);
                      setOwnProfileFull(prev => prev ? { ...prev, profile_picture: publicUrl } : prev);
                      toast.success("Profile picture updated");
                    }}
                  />
                  <button
                    onClick={() => document.getElementById('profile-pic-input')?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-background"
                  >
                    <Camera className="w-3 h-3 text-primary-foreground" />
                  </button>
                </>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
                {countryList.map((c: string) => (
                  <span key={c} className="text-lg" title={c}>{getFlagEmoji(c)}</span>
                ))}
              </div>
              {/* Instagram-style follower / following counts */}
              <div className="flex items-center gap-5 mt-2">
                <button
                  onClick={() => handleOpenFollowList("Followers")}
                  className="text-left active:opacity-70"
                  aria-label={`${followersCount} ${t("profile.followers")}`}
                >
                  <div className="text-sm font-bold text-foreground leading-tight">{followersCount}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{t("profile.followers")}</div>
                </button>
                <button
                  onClick={() => handleOpenFollowList("Following")}
                  className="text-left active:opacity-70"
                  aria-label={`${followingCount} ${t("profile.following")}`}
                >
                  <div className="text-sm font-bold text-foreground leading-tight">{followingCount}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{t("profile.following")}</div>
                </button>
              </div>
            </div>
          </div>
          {isOwnProfile ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setEditOpen(true)} className="p-2" aria-label={t("profile.editProfile")}>
                <Pencil className="w-5 h-5 text-muted-foreground" />
              </button>
              <button onClick={() => setShareOpen(true)} className="p-2" aria-label={t("share.shareProfile")}>
                <Share2 className="w-5 h-5 text-muted-foreground" />
              </button>
              <button onClick={() => navigate("/settings")} className="p-2" aria-label={t("settings")}>
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          ) : user && !isBlocked && (
            <button
              onClick={toggleFollow}
              disabled={togglingFollow}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isFollowing
                  ? "bg-card border border-border text-foreground"
                  : hasPendingRequest
                    ? "bg-muted text-muted-foreground border border-border"
                    : "bg-primary text-primary-foreground"
              }`}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="w-3.5 h-3.5" />
                  {t("profile.unfollow")}
                </>
              ) : hasPendingRequest ? (
                <span>{t("profile.requested")}</span>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  {t("profile.follow")}
                </>
              )}
            </button>
          )}
        </div>

        {/* Bio + Social links */}
        {!isBlocked && (profileBio || Object.keys(sanitizeSocialLinks((currentProfile as any)?.social_links)).length > 0) && (
          <div className="mb-4">
            {profileBio && <RichBio text={profileBio} />}
            <SocialLinks links={sanitizeSocialLinks((currentProfile as any)?.social_links)} />
          </div>
        )}

        {/* Blocked state */}
        {!isOwnProfile && isBlocked && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">This content is not available.</p>
          </div>
        )}

        {/* Private account - not following */}
        {!isOwnProfile && !isBlocked && viewedProfile?.is_private && !isFollowing && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm font-semibold text-foreground mb-1">This account is private</p>
            <p className="text-xs text-muted-foreground">Follow this account to see their content.</p>
          </div>
        )}

        {/* Content visible when not blocked and not private-restricted */}
        {(isOwnProfile || (!isBlocked && (!viewedProfile?.is_private || isFollowing))) && <>
        {/* Admin Stats */}
        {isOwnProfile && user && <AdminStats userId={user.id} />}

        {/* Favorite Countries */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground mb-3">Favorite Countries</h2>
          {renderFavoriteSlots("country", favoriteCountries)}
        </div>
        <div className="mb-6"><RatingHistogram distribution={countryDistribution} onBarClick={(r) => { setRatingFilter(r); setSubPage("CountriesByRating"); }} /></div>

        {/* Favorite Cities */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground mb-3">Favorite Cities</h2>
          {renderFavoriteSlots("city", favoriteCities)}
        </div>
        <div className="mb-6"><RatingHistogram distribution={cityDistribution} onBarClick={(r) => { setRatingFilter(r); setSubPage("CitiesByRating"); }} /></div>

        {/* Map Preview */}
        {mapMyData && (
          <div className="mb-6">
            <button
              onClick={() => setSubPage("Map")}
              className="flex items-center justify-between w-full mb-3"
            >
              <h2 className="text-lg font-bold text-foreground">{t("profile.map")}</h2>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ height: 220 }}>
              {!isOwnProfile && mapTheirData ? (
                <CompareMapChart
                  myData={mapMyData}
                  theirData={mapTheirData}
                  onCountryClick={(alpha2) => {
                    const placeId = mapMyData?.countryPlaceMap[alpha2] || mapTheirData?.countryPlaceMap[alpha2];
                    if (placeId) navigate(`/place/${placeId}`);
                  }}
                />
              ) : (
                <SoloMapChart
                  data={mapMyData}
                  onCountryClick={(alpha2) => {
                    const placeId = mapMyData?.countryPlaceMap[alpha2];
                    if (placeId) navigate(`/place/${placeId}`);
                  }}
                  onCityClick={(placeId) => navigate(`/place/${placeId}`)}
                />
              )}
            </div>
            {/* Legend */}
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              {!isOwnProfile && mapTheirData ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(217, 91%, 60%)" }} />
                    <span>You</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(40, 95%, 55%)" }} />
                    <span>{displayName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(150, 60%, 45%)" }} />
                    <span>Both</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

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
        </>}
      </div>

      {isOwnProfile && <FavoritePicker open={pickerOpen} onClose={() => setPickerOpen(false)} type={pickerType} onSelect={handleFavoriteSelected} />}
      {isOwnProfile && currentProfile && (
        <ProfileEditSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={handleProfileSaved}
          currentData={{
            username: currentProfile.username,
            bio: profileBio,
            country: profileCountry,
            social_links: sanitizeSocialLinks((currentProfile as any)?.social_links),
          }}
        />
      )}
      {currentProfile && viewingUserId && (
        <ShareProfileSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          profile={{
            userId: viewingUserId,
            username: currentProfile.username,
            profile_picture: currentProfile.profile_picture,
            bio: profileBio,
            country: profileCountry,
          }}
          stats={{
            countries: countriesCount,
            cities: citiesCount,
            followers: followersCount,
          }}
        />
      )}
    </div>
  );
}
