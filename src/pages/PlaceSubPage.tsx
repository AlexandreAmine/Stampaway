import { useState, useEffect, useRef } from "react";
import { ChevronLeft, MessageSquare, SlidersHorizontal } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { ReviewCard } from "@/components/ReviewCard";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PlaceCategoryRatings } from "@/components/SubRatingsDisplay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Section = "visitors" | "friendvisitors" | "reviews" | "lists" | "wanttovisit" | "categories";
const REVIEW_LIKE_PAGE_SIZE = 1000;
const REVIEW_ID_CHUNK_SIZE = 100;

type ReviewLikeSnapshot = {
  likeCounts: Map<string, number>;
  likedByCurrentUser: Set<string>;
};

type ReviewCardLikeSnapshotStatus = "loading" | "ready" | "unavailable";

type ReviewCardLikeSnapshotState = ReviewLikeSnapshot & {
  requestId: number;
  placeId: string | null;
  section: string | null;
  userId: string | null;
  status: ReviewCardLikeSnapshotStatus;
};

type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false };

type PlaceSubPageDataContext = {
  requestId: number;
  placeId: string;
  section: string;
  userId: string | null;
};

type PlaceSubPageSectionResult = {
  data: any[];
  reviewLikeCounts?: Map<string, number>;
  friendIds?: string[];
  reviewIds?: string[];
};

const chunkReviewIds = (reviewIds: string[]) => {
  const ids = [...new Set(reviewIds.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += REVIEW_ID_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + REVIEW_ID_CHUNK_SIZE));
  }
  return chunks;
};

async function fetchReviewCardLikeSnapshot(reviewIds: string[], currentUserId: string | null): Promise<ReviewLikeSnapshot> {
  const likeCounts = new Map<string, number>();
  const likedByCurrentUser = new Set<string>();
  reviewIds.forEach((reviewId) => likeCounts.set(reviewId, 0));

  for (const reviewIdChunk of chunkReviewIds(reviewIds)) {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("review_likes")
        .select("id, review_id, user_id")
        .in("review_id", reviewIdChunk)
        .order("review_id", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + REVIEW_LIKE_PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((like: any) => {
        likeCounts.set(like.review_id, (likeCounts.get(like.review_id) || 0) + 1);
        if (currentUserId && like.user_id === currentUserId) likedByCurrentUser.add(like.review_id);
      });

      if (data.length < REVIEW_LIKE_PAGE_SIZE) break;
      offset += REVIEW_LIKE_PAGE_SIZE;
    }
  }

  return { likeCounts, likedByCurrentUser };
}

export default function PlaceSubPage() {
  const { id, section } = useParams<{ id: string; section: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [placeName, setPlaceName] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<"most_liked" | "most_recent" | "friends_first">("most_liked");
  const [reviewLikeCounts, setReviewLikeCounts] = useState<Map<string, number>>(new Map());
  const [reviewCardLikeSnapshot, setReviewCardLikeSnapshot] = useState<ReviewCardLikeSnapshotState | null>(null);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const currentContextRef = useRef({ placeId: null as string | null, section: null as string | null, userId: null as string | null });
  const dataRequestIdRef = useRef(0);
  const lastAppliedDataContextRef = useRef<{
    placeId: string;
    section: string;
    userId: string | null;
  } | null>(null);
  const reviewCardLikeSnapshotRequestIdRef = useRef(0);

  currentContextRef.current = { placeId: id ?? null, section: section ?? null, userId: user?.id ?? null };

  const isCurrentReviewCardLikeContext = (snapshot: Pick<ReviewCardLikeSnapshotState, "requestId" | "placeId" | "section" | "userId">) => (
    reviewCardLikeSnapshotRequestIdRef.current === snapshot.requestId &&
    currentContextRef.current.placeId === snapshot.placeId &&
    currentContextRef.current.section === snapshot.section &&
    currentContextRef.current.userId === snapshot.userId
  );

  const startReviewCardLikeSnapshot = (reviewIds: string[]) => {
    const requestId = reviewCardLikeSnapshotRequestIdRef.current + 1;
    reviewCardLikeSnapshotRequestIdRef.current = requestId;

    const requestContext = {
      requestId,
      placeId: id ?? null,
      section: section ?? null,
      userId: user?.id ?? null,
    };

    setReviewCardLikeSnapshot({
      ...requestContext,
      status: "loading",
      likeCounts: new Map(),
      likedByCurrentUser: new Set(),
    });

    if (reviewIds.length === 0) {
      setReviewCardLikeSnapshot({
        ...requestContext,
        status: "ready",
        likeCounts: new Map(),
        likedByCurrentUser: new Set(),
      });
      return;
    }

    fetchReviewCardLikeSnapshot(reviewIds, requestContext.userId)
      .then((snapshot) => {
        const nextSnapshot = { ...requestContext, ...snapshot, status: "ready" as const };
        if (isCurrentReviewCardLikeContext(nextSnapshot)) {
          setReviewCardLikeSnapshot(nextSnapshot);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch review card like snapshot:", error);
        const unavailableSnapshot = {
          ...requestContext,
          status: "unavailable" as const,
          likeCounts: new Map<string, number>(),
          likedByCurrentUser: new Set<string>(),
        };
        if (isCurrentReviewCardLikeContext(unavailableSnapshot)) {
          setReviewCardLikeSnapshot(unavailableSnapshot);
        }
      });
  };

  useEffect(() => {
    if (!id || !section) return;

    void fetchData();
    return () => {
      dataRequestIdRef.current += 1;
    };
  }, [id, section, user?.id]);

  const isCurrentDataRequest = (context: PlaceSubPageDataContext) => (
    dataRequestIdRef.current === context.requestId &&
    currentContextRef.current.placeId === context.placeId &&
    currentContextRef.current.section === context.section &&
    currentContextRef.current.userId === context.userId
  );

  const loadPlaceName = async (
    context: PlaceSubPageDataContext
  ): Promise<LoadResult<string>> => {
    try {
      const { data: place, error } = await supabase
        .from("places")
        .select("name")
        .eq("id", context.placeId)
        .maybeSingle();

      if (error) throw error;
      return { ok: true, data: place?.name || "" };
    } catch (error) {
      console.error("Failed to load place name:", error);
      return { ok: false };
    }
  };

  const fetchSectionData = async (
    context: PlaceSubPageDataContext
  ): Promise<PlaceSubPageSectionResult> => {
    if (context.section === "categories") {
      return { data: [] };
    }

    if (context.section === "visitors" || context.section === "friendvisitors") {
      const followingPromise = async () => {
        if (context.section !== "friendvisitors" || !context.userId) {
          return [] as { following_id: string }[];
        }

        const { data: following, error } = await supabase
          .from("followers")
          .select("following_id")
          .eq("follower_id", context.userId);

        if (error) throw error;
        return following || [];
      };

      const reviewsPromise = async () => {
        const { data: reviews, error } = await supabase
          .from("reviews")
          .select("id, rating, user_id, review_text, liked, created_at")
          .eq("place_id", context.placeId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return reviews || [];
      };

      const [following, reviews] = await Promise.all([
        followingPromise(),
        reviewsPromise(),
      ]);
      if (!isCurrentDataRequest(context)) return { data: [] };

      const followingSet = new Set(following.map((entry) => entry.following_id));

      // Most recent per user
      const seen = new Set<string>();
      let unique = reviews.filter((review) => {
        if (seen.has(review.user_id)) return false;
        seen.add(review.user_id);
        return true;
      });

      // For friendvisitors, filter to only people the user follows
      if (context.section === "friendvisitors") {
        unique = unique.filter((review) => followingSet.has(review.user_id));
      }

      const userIds = unique.map((review) => review.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, username, profile_picture")
        .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

      if (profilesError) throw profilesError;

      const profileMap = new Map(
        (profiles || []).map((profile) => [profile.user_id, profile])
      );

      return {
        data: unique.map((review) => ({
          ...review,
          profile: profileMap.get(review.user_id),
          has_review: !!(review.review_text && review.review_text.trim() !== ""),
        })),
      };
    }

    if (context.section === "reviews") {
      const { data: reviews, error: reviewsError } = await supabase
        .from("reviews")
        .select("id, rating, user_id, review_text, liked, created_at")
        .eq("place_id", context.placeId)
        .not("review_text", "is", null)
        .neq("review_text", "")
        .order("created_at", { ascending: false });

      if (reviewsError) throw reviewsError;

      // Most recent written review per user
      const seen = new Set<string>();
      const unique = (reviews || []).filter((r) => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      });

      const userIds = unique.map((r) => r.user_id);
      const reviewIds = unique.map((r) => r.id);

      const profilesPromise = async () => {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", userIds);

        if (error) throw error;
        return profiles || [];
      };

      const likesPromise = async () => {
        if (reviewIds.length === 0) {
          return [] as { review_id: string }[];
        }

        const { data: likes, error } = await supabase
          .from("review_likes")
          .select("review_id")
          .in("review_id", reviewIds);

        if (error) throw error;
        return likes || [];
      };

      const followingPromise = async () => {
        if (!context.userId) {
          return [] as { following_id: string }[];
        }

        const { data: following, error } = await supabase
          .from("followers")
          .select("following_id")
          .eq("follower_id", context.userId);

        if (error) throw error;
        return following || [];
      };

      const [profiles, likes, following] = await Promise.all([
        profilesPromise(),
        likesPromise(),
        followingPromise(),
      ]);
      if (!isCurrentDataRequest(context)) return { data: [] };

      const likeCounts = new Map<string, number>();
      likes.forEach((like) => {
        likeCounts.set(like.review_id, (likeCounts.get(like.review_id) || 0) + 1);
      });

      const profileMap = new Map(
        profiles.map((profile) => [profile.user_id, profile])
      );

      return {
        data: unique.map((review) => ({
          ...review,
          profile: profileMap.get(review.user_id),
        })),
        reviewLikeCounts: likeCounts,
        friendIds: following.map((entry) => entry.following_id),
        reviewIds,
      };
    }

    if (context.section === "lists") {
      const { data: listItems, error: listItemsError } = await supabase
        .from("list_items")
        .select("list_id, lists!inner(id, name, user_id)")
        .eq("place_id", context.placeId);

      if (listItemsError) throw listItemsError;

      if (listItems && listItems.length > 0) {
        const listUserIds = [...new Set((listItems as any[]).map((li: any) => li.lists.user_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", listUserIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map(
          (profiles || []).map((profile) => [profile.user_id, profile])
        );

        return {
          data: (listItems as any[]).map((listItem: any) => ({
            list_id: listItem.lists.id,
            list_name: listItem.lists.name,
            profile: profileMap.get(listItem.lists.user_id),
          })),
        };
      }

      return { data: [] };
    }

    if (context.section === "wanttovisit") {
      const { data: wishlistData, error: wishlistError } = await supabase
        .from("wishlists")
        .select("user_id")
        .eq("place_id", context.placeId);

      if (wishlistError) throw wishlistError;

      if (wishlistData && wishlistData.length > 0) {
        const userIds = wishlistData.map((w) => w.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", userIds);

        if (profilesError) throw profilesError;
        return { data: profiles || [] };
      }

      return { data: [] };
    }

    return { data: [] };
  };

  const loadSectionData = async (
    context: PlaceSubPageDataContext
  ): Promise<LoadResult<PlaceSubPageSectionResult>> => {
    try {
      return {
        ok: true,
        data: await fetchSectionData(context),
      };
    } catch (error) {
      console.error("Failed to load place subsection:", error);
      return { ok: false };
    }
  };

  const fetchData = async () => {
    if (!id || !section) return;

    const requestContext: PlaceSubPageDataContext = {
      requestId: dataRequestIdRef.current + 1,
      placeId: id,
      section,
      userId: user?.id ?? null,
    };
    dataRequestIdRef.current = requestContext.requestId;

    const previousContext = lastAppliedDataContextRef.current;
    const sameContext = (
      previousContext?.placeId === requestContext.placeId &&
      previousContext.section === requestContext.section &&
      previousContext.userId === requestContext.userId
    );

    setLoading(true);

    if (!sameContext) {
      setPlaceName("");
      setData([]);
      setReviewLikeCounts(new Map());
      setFriendIds([]);
      reviewCardLikeSnapshotRequestIdRef.current += 1;
      setReviewCardLikeSnapshot(null);
    }

    try {
      const [placeResult, sectionResult] = await Promise.all([
        loadPlaceName(requestContext),
        loadSectionData(requestContext),
      ]);

      if (!isCurrentDataRequest(requestContext)) return;

      if (placeResult.ok) {
        setPlaceName(placeResult.data);
      }

      if (sectionResult.ok) {
        const nextSection = sectionResult.data;
        setData(nextSection.data);

        if (nextSection.reviewLikeCounts) {
          setReviewLikeCounts(nextSection.reviewLikeCounts);
        }

        if (nextSection.friendIds) {
          setFriendIds(nextSection.friendIds);
        }

        if (nextSection.reviewIds) {
          startReviewCardLikeSnapshot(nextSection.reviewIds);
        }
      }

      if (placeResult.ok || sectionResult.ok) {
        lastAppliedDataContextRef.current = {
          placeId: requestContext.placeId,
          section: requestContext.section,
          userId: requestContext.userId,
        };
      }
    } catch (error) {
      console.error("Unexpected place subsection loading failure:", error);
    } finally {
      if (isCurrentDataRequest(requestContext)) {
        setLoading(false);
      }
    }
  };

  const title = section === "visitors" ? "Visitors" : section === "friendvisitors" ? "Visited by friends" : section === "reviews" ? "Reviews" : section === "wanttovisit" ? "Want to go" : section === "categories" ? "Category Ratings" : "Lists";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground">{placeName}</p>
          </div>
          {section === "reviews" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-auto w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReviewFilter("most_liked")} className={reviewFilter === "most_liked" ? "bg-accent" : ""}>
                  Most liked
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReviewFilter("most_recent")} className={reviewFilter === "most_recent" ? "bg-accent" : ""}>
                  Most recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReviewFilter("friends_first")} className={reviewFilter === "friends_first" ? "bg-accent" : ""}>
                  Friend reviews first
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {loading && section !== "categories" ? (
          <div className="space-y-3 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : section === "categories" ? (
          <PlaceCategoryRatings placeId={id!} userId={user?.id} />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No {title.toLowerCase()} yet</p>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {(section === "visitors" || section === "friendvisitors") &&
              data.map((v: any) => (
                <div key={v.user_id} className="flex items-center gap-3 w-full">
                  <button onClick={() => navigate(v.user_id === user?.id ? "/profile" : `/profile/${v.user_id}`)} className="flex items-center gap-3 min-w-0 w-1/2 text-left">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={v.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.profile?.username || "?")}&background=3B82F6&color=fff`} />
                      <AvatarFallback>{v.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-foreground flex-1">{v.profile?.username || "User"}</p>
                  </button>
                  <button onClick={() => navigate(`/review/${v.id}`)} className="flex items-center justify-end gap-1.5 active:scale-95 transition-transform w-1/2 min-h-9 text-right">
                    {v.rating != null && <StarRating rating={Number(v.rating)} size={12} liked={v.liked} />}
                    {v.has_review && <MessageSquare className="w-3 h-3 text-primary" />}
                  </button>
                </div>
              ))}

            {section === "reviews" &&
              (() => {
                let sorted = [...data];
                if (reviewFilter === "most_liked") {
                  sorted.sort((a, b) => (reviewLikeCounts.get(b.id) || 0) - (reviewLikeCounts.get(a.id) || 0));
                } else if (reviewFilter === "most_recent") {
                  sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                } else if (reviewFilter === "friends_first") {
                  sorted.sort((a, b) => {
                    const aFriend = friendIds.includes(a.user_id) ? 1 : 0;
                    const bFriend = friendIds.includes(b.user_id) ? 1 : 0;
                    if (bFriend !== aFriend) return bFriend - aFriend;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  });
                }
                return sorted.map((rv: any) => {
                  const snapshotMatches =
                    reviewCardLikeSnapshot?.placeId === id &&
                    reviewCardLikeSnapshot.section === section &&
                    reviewCardLikeSnapshot.userId === (user?.id ?? null);
                  const hasReviewCardLikeSnapshot =
                    snapshotMatches &&
                    reviewCardLikeSnapshot.status === "ready" &&
                    reviewCardLikeSnapshot.likeCounts.has(rv.id);
                  const likeDataStatus = hasReviewCardLikeSnapshot
                    ? "ready"
                    : snapshotMatches && reviewCardLikeSnapshot.status === "loading"
                    ? "loading"
                    : "unavailable";

                  return (
                    <ReviewCard
                      key={rv.id}
                      review={{
                        id: rv.id,
                        user_id: rv.user_id,
                        rating: rv.rating,
                        review_text: rv.review_text,
                        created_at: rv.created_at,
                        profile_username: rv.profile?.username,
                        profile_picture: rv.profile?.profile_picture,
                      }}
                      showImage={false}
                      hidePlaceName
                      likeDataStatus={likeDataStatus}
                      initialLikeCount={hasReviewCardLikeSnapshot ? reviewCardLikeSnapshot.likeCounts.get(rv.id) : undefined}
                      initialLikedByCurrentUser={hasReviewCardLikeSnapshot ? reviewCardLikeSnapshot.likedByCurrentUser.has(rv.id) : undefined}
                    />
                  );
                });
              })()}

            {section === "lists" &&
              data.map((l: any, i: number) => (
                <button key={i} onClick={() => navigate(`/list/${l.list_id}`)} className="flex items-center gap-3 w-full text-left">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={l.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.profile?.username || "?")}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{l.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" data-no-translate>{l.list_name}</p>
                    <p className="text-xs text-muted-foreground" data-no-translate>by {l.profile?.username || "User"}</p>
                  </div>
                </button>
              ))}

            {section === "wanttovisit" &&
              data.map((w: any) => (
                <button key={w.user_id} onClick={() => navigate(w.user_id === user?.id ? "/profile" : `/profile/${w.user_id}`)} className="flex items-center gap-3 w-full text-left">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={w.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(w.username || "?")}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{w.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-foreground flex-1" data-no-translate>{w.username || "User"}</p>
                </button>
              ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
