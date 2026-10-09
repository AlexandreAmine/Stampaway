import { useState, useEffect } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Ban, Bookmark, ChevronLeft, Circle, Heart, ListPlus, MapPin, MapPinned, MessageCircle, Pencil, Star, Target, UserPlus, type LucideIcon, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { timeAgo } from "@/lib/localeFormat";
import { getCachedAnyPlaceName } from "@/lib/placeNames";
import { continentLabel } from "@/lib/continentLabels";

// Raw names are kept and the sentence is built at render time, so it follows
// the app language (and place names get their localized form).
interface ActivityParams {
  place?: string;
  user?: string;
  list?: string;
  year?: string;
  continent?: string;
}

// Line icons, matching the rest of the app (these used to be emoji).
const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  log: MapPin,
  edit: Pencil,
  review_like: Heart,
  comment: MessageCircle,
  list_like: Heart,
  follow: UserPlus,
  block: Ban,
  wishlist: Bookmark,
  list_create: ListPlus,
  favorite: Star,
  goal_set: Target,
  goal_edit: Target,
  goal_place: MapPinned,
};

function ActivityIcon({ type }: { type: string }) {
  const Icon = ACTIVITY_ICONS[type] ?? Circle;
  return (
    <span className="w-8 h-8 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
      <Icon className="w-4 h-4 text-muted-foreground" />
    </span>
  );
}

interface ActivityItem {
  id: string;
  type: string;
  key: TranslationKey;
  params: ActivityParams;
  created_at: string;
}

export function YourActivity({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const all: ActivityItem[] = [];

      // Stage 1 — every per-user listing is independent; fetch them all at once.
      const [
        { data: reviews },
        { data: reviewLikes },
        { data: myComments },
        { data: listLikes },
        { data: following },
        { data: blocks },
        { data: wishlists },
        { data: lists },
        { data: goals },
        { data: goalPlaces },
        { data: favorites },
      ] = await Promise.all([
        supabase.from("reviews").select("id, created_at, updated_at, place_id").eq("user_id", user.id),
        supabase.from("review_likes").select("id, created_at, review_id").eq("user_id", user.id),
        supabase.from("review_comments").select("id, created_at, comment_text, review_id, parent_id").eq("user_id", user.id),
        supabase.from("list_likes").select("id, created_at, list_id").eq("user_id", user.id),
        supabase.from("followers").select("id, created_at, following_id").eq("follower_id", user.id),
        supabase.from("blocked_users").select("id, created_at, blocked_id").eq("blocker_id", user.id),
        supabase.from("wishlists").select("id, created_at, place_id").eq("user_id", user.id),
        supabase.from("lists").select("id, created_at, name").eq("user_id", user.id),
        supabase.from("yearly_goals").select("id, created_at, updated_at, year, continent").eq("user_id", user.id),
        supabase.from("yearly_goal_places").select("id, created_at, place_id, year").eq("user_id", user.id),
        supabase.from("favorite_places").select("id, created_at, place_id").eq("user_id", user.id),
      ]);

      // Stage 2 — reviews referenced by my likes and comments, liked lists.
      const referencedReviewIds = [
        ...new Set([
          ...(reviewLikes || []).map(l => l.review_id),
          ...(myComments || []).map(c => c.review_id),
        ]),
      ];
      const likedListIds = (listLikes || []).map(l => l.list_id);

      const [refReviewsRes, likedListsRes] = await Promise.all([
        referencedReviewIds.length > 0
          ? supabase.from("reviews").select("id, user_id, place_id").in("id", referencedReviewIds)
          : Promise.resolve({ data: [] as { id: string; user_id: string; place_id: string }[] }),
        likedListIds.length > 0
          ? supabase.from("lists").select("id, name").in("id", likedListIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      const refReviewMap = new Map((refReviewsRes.data || []).map(r => [r.id, r]));
      const likedListMap: Record<string, string> = {};
      (likedListsRes.data || []).forEach(l => { likedListMap[l.id] = l.name; });

      // Stage 3 — one profiles query and one places query for every name we need.
      const neededUserIds = [
        ...new Set([
          ...(refReviewsRes.data || []).map(r => r.user_id),
          ...(following || []).map(f => f.following_id),
          ...(blocks || []).map(b => b.blocked_id),
        ]),
      ];
      const neededPlaceIds = [
        ...new Set([
          ...(reviews || []).map(r => r.place_id),
          ...(refReviewsRes.data || []).map(r => r.place_id),
          ...(wishlists || []).map(w => w.place_id),
          ...(goalPlaces || []).map(g => g.place_id),
          ...(favorites || []).map(f => f.place_id),
        ]),
      ];

      const [profilesRes, placesRes] = await Promise.all([
        neededUserIds.length > 0
          ? supabase.from("profiles").select("user_id, username").in("user_id", neededUserIds)
          : Promise.resolve({ data: [] as { user_id: string; username: string }[] }),
        neededPlaceIds.length > 0
          ? supabase.from("places").select("id, name").in("id", neededPlaceIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      const userMap: Record<string, string> = {};
      (profilesRes.data || []).forEach(p => { userMap[p.user_id] = p.username; });
      const placeMap: Record<string, string> = {};
      (placesRes.data || []).forEach(p => { placeMap[p.id] = p.name; });

      // Assemble items (identical descriptions/ids to the previous version).
      (reviews || []).forEach(r => {
        all.push({ id: `log-${r.id}`, type: "log", key: "activity.logged", params: { place: placeMap[r.place_id] }, created_at: r.created_at });
        if (r.updated_at && r.updated_at !== r.created_at) {
          all.push({ id: `edit-${r.id}`, type: "edit", key: "activity.edited", params: { place: placeMap[r.place_id] }, created_at: r.updated_at });
        }
      });

      (reviewLikes || []).forEach(l => {
        const rev = refReviewMap.get(l.review_id);
        const params = { user: rev ? userMap[rev.user_id] : undefined, place: rev ? placeMap[rev.place_id] : undefined };
        all.push({ id: `rl-${l.id}`, type: "review_like", key: "activity.likedReview", params, created_at: l.created_at });
      });

      (myComments || []).forEach(c => {
        const rev = refReviewMap.get(c.review_id);
        const params = { user: rev ? userMap[rev.user_id] : undefined, place: rev ? placeMap[rev.place_id] : undefined };
        const key = c.parent_id ? "activity.repliedReview" : "activity.commentedReview";
        all.push({ id: `cm-${c.id}`, type: "comment", key, params, created_at: c.created_at });
      });

      (listLikes || []).forEach(l => {
        all.push({ id: `ll-${l.id}`, type: "list_like", key: "activity.likedList", params: { list: likedListMap[l.list_id] }, created_at: l.created_at });
      });

      (following || []).forEach(f => {
        all.push({ id: `fol-${f.id}`, type: "follow", key: "activity.followed", params: { user: userMap[f.following_id] }, created_at: f.created_at });
      });

      (blocks || []).forEach(b => {
        all.push({ id: `blk-${b.id}`, type: "block", key: "activity.blocked", params: { user: userMap[b.blocked_id] }, created_at: b.created_at });
      });

      (wishlists || []).forEach(w => {
        all.push({ id: `wl-${w.id}`, type: "wishlist", key: "activity.wishlisted", params: { place: placeMap[w.place_id] }, created_at: w.created_at });
      });

      (lists || []).forEach(l => {
        all.push({ id: `lst-${l.id}`, type: "list_create", key: "activity.createdList", params: { list: l.name }, created_at: l.created_at });
      });

      (goals || []).forEach(g => {
        const params = { year: String(g.year), continent: g.continent };
        all.push({ id: `goal-${g.id}`, type: "goal_set", key: "activity.goalSet", params, created_at: g.created_at });
        if (g.updated_at && g.updated_at !== g.created_at) {
          all.push({ id: `goal-edit-${g.id}`, type: "goal_edit", key: "activity.goalEdited", params, created_at: g.updated_at });
        }
      });

      (goalPlaces || []).forEach(g => {
        all.push({ id: `gp-${g.id}`, type: "goal_place", key: "activity.goalPlace", params: { place: placeMap[g.place_id], year: String(g.year) }, created_at: g.created_at });
      });

      (favorites || []).forEach(f => {
        all.push({ id: `fav-${f.id}`, type: "favorite", key: "activity.favorited", params: { place: placeMap[f.place_id] }, created_at: f.created_at });
      });

      // Sort by most recent
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(all);
      setLoading(false);
    })();
  }, [user]);

  const describe = ({ key, params }: ActivityItem) => {
    const year = params.year ?? "";
    const goal = params.continent && params.continent !== "total"
      ? `${year} (${continentLabel(params.continent, t)})`
      : year;
    return t(key, {
      place: params.place ? getCachedAnyPlaceName(params.place, language) : t("activity.aDestination"),
      user: params.user || t("activity.someone"),
      list: params.list || t("activity.aList"),
      goal,
      year,
    });
  };


  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button aria-label={t("back")} onClick={onBack}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="page-title">{t("activity.title")}</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-muted/40 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <EmptyState icon={Activity} title={t("activity.noActivity")} />
        ) : (
          <div className="space-y-0">
            {activities.map(a => (
              <div key={a.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                <ActivityIcon type={a.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{describe(a)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {timeAgo(a.created_at, language)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
