import { useEffect, useRef, useState } from "react";
import { Heart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { StarRating } from "@/components/StarRating";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { hapticLight } from "@/lib/haptics";
import { SUB_CATEGORIES, subCategoryLabel } from "@/lib/subCategories";
import { monthShortNames } from "@/lib/localeFormat";
import type { ReviewDraft, TaggedUser } from "@/lib/reviewDraft";

export interface FollowingLookup {
  userId: string | null;
  ids: Set<string> | null;
  failed: boolean;
}

/**
 * Who the viewer follows, for tagging: private accounts can only be tagged
 * by their followers. Loaded once by the screen that hosts the form(s).
 */
export function useFollowingLookup(): FollowingLookup {
  const { user } = useAuth();
  const [followingLookup, setFollowingLookup] = useState<FollowingLookup>({ userId: null, ids: new Set(), failed: false });
  const followingRequestIdRef = useRef(0);

  useEffect(() => {
    const viewerId = user?.id ?? null;
    const requestId = ++followingRequestIdRef.current;
    let cancelled = false;

    setFollowingLookup({
      userId: viewerId,
      ids: viewerId ? null : new Set(),
      failed: false,
    });

    if (!viewerId) return;

    const loadFollowingIds = async () => {
      try {
        const { data, error } = await supabase
          .from("followers")
          .select("following_id")
          .eq("follower_id", viewerId);
        if (error) throw error;

        if (cancelled || followingRequestIdRef.current !== requestId) return;
        setFollowingLookup({
          userId: viewerId,
          ids: new Set((data || []).map((follow) => follow.following_id)),
          failed: false,
        });
      } catch {
        if (cancelled || followingRequestIdRef.current !== requestId) return;
        setFollowingLookup({
          userId: viewerId,
          ids: null,
          failed: true,
        });
        console.error("Failed to load Add Place following IDs");
      }
    };

    void loadFollowingIds();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return followingLookup;
}

/**
 * The rating form used to log a place: overall rating and like, review text
 * and sub-ratings, when you went, and who you went with. Shared by the Add
 * screen and the import-from-photos cards so both stay identical.
 */
export function ReviewFormFields({
  draft,
  onChange,
  followingLookup,
}: {
  draft: ReviewDraft;
  onChange: (update: (prev: ReviewDraft) => ReviewDraft) => void;
  followingLookup: FollowingLookup;
}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<TaggedUser[]>([]);
  const tagSearchRequestIdRef = useRef(0);
  const set = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const requestId = ++tagSearchRequestIdRef.current;
    const search = tagQuery.trim();
    const viewerId = user?.id ?? null;
    const lookupMatchesViewer = followingLookup.userId === viewerId;
    const followingIds = lookupMatchesViewer ? followingLookup.ids : null;

    if (!search) {
      setTagResults([]);
      return;
    }

    if (viewerId && (!lookupMatchesViewer || followingLookup.failed || !followingIds)) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture, is_private")
          .ilike("username", `%${search}%`)
          .limit(20);
        if (error) throw error;

        if (cancelled || tagSearchRequestIdRef.current !== requestId) return;

        const taggedUserIds = new Set(draft.taggedUsers.map((tagged) => tagged.user_id));
        const visibleFollowingIds = followingIds || new Set<string>();
        const filtered = (profiles || []).filter(
          (profile) =>
            profile.user_id !== viewerId &&
            !taggedUserIds.has(profile.user_id) &&
            (!profile.is_private || visibleFollowingIds.has(profile.user_id))
        );
        setTagResults(filtered.slice(0, 10));
      } catch {
        if (!cancelled && tagSearchRequestIdRef.current === requestId) {
          console.error("Failed to search Add Place tags");
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tagQuery, draft.taggedUsers, user?.id, followingLookup]);

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps mb-3">{t("review.yourRating")}</p>
        <div className="flex items-center justify-between">
          <StarRating rating={draft.rating} size={40} interactive onChange={(v) => set("rating", v)} />
          <button
            type="button"
            onClick={() => { hapticLight(); set("liked", !draft.liked); }}
            aria-pressed={draft.liked}
            aria-label={t("reviewDetail.liked")}
            className="p-1 -m-1 transition-transform active:scale-90"
          >
            <Heart className={`w-7 h-7 transition-colors ${draft.liked ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
          </button>
        </div>
      </div>

      <div>
        <textarea
          value={draft.reviewText}
          onChange={(e) => set("reviewText", e.target.value)}
          placeholder={t("review.placeholder")}
          className="w-full h-24 bg-card rounded-lg p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none border border-border focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="mt-3 space-y-2">
          {SUB_CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{subCategoryLabel(cat, t)}</span>
              <StarRating
                rating={draft.subRatings[cat] || 0}
                size={16}
                interactive
                onChange={(v) => onChange((prev) => ({ ...prev, subRatings: { ...prev.subRatings, [cat]: v } }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="label-caps">{t("review.whenVisit")}</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">{t("review.year")}</label>
            <select
              value={draft.visitYear}
              onChange={(e) => set("visitYear", e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-card rounded-xl py-2.5 px-3 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">—</option>
              {Array.from({ length: new Date().getFullYear() - 1977 + 1 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">{t("review.month")}</label>
            <select
              value={draft.visitMonth}
              onChange={(e) => set("visitMonth", e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-card rounded-xl py-2.5 px-3 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">—</option>
              {monthShortNames(language).map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">{t("diary.duration")}</label>
            <input
              type="number"
              inputMode="numeric"
              value={draft.durationDays}
              onChange={(e) => set("durationDays", e.target.value ? Number(e.target.value) : "")}
              placeholder={t("review.daysPlaceholder")}
              min={1}
              className="w-full bg-card rounded-lg py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Tag people */}
      <div>
        <p className="label-caps mb-2">{t("review.tagPeople")}</p>
        {draft.taggedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {draft.taggedUsers.map((u) => (
              <div key={u.user_id} className="flex items-center gap-1.5 bg-card border border-border rounded-full px-2.5 py-1">
                <Avatar className="w-4 h-4">
                  {u.profile_picture ? <AvatarImage src={u.profile_picture} /> : <AvatarFallback className="text-[8px]">{u.username[0]?.toUpperCase()}</AvatarFallback>}
                </Avatar>
                <span className="text-xs font-medium text-foreground" data-no-translate>{u.username}</span>
                <button aria-label={t("common.remove")} onClick={() => set("taggedUsers", draft.taggedUsers.filter((tagged) => tagged.user_id !== u.user_id))} className="ml-0.5">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <input
            type="text"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder={t("review.searchUsername")}
            className="w-full bg-card rounded-lg py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {tagResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-20 max-h-40 overflow-y-auto">
              {tagResults.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => {
                    set("taggedUsers", [...draft.taggedUsers, p]);
                    setTagQuery("");
                    setTagResults([]);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                >
                  <Avatar className="w-6 h-6">
                    {p.profile_picture ? <AvatarImage src={p.profile_picture} /> : <AvatarFallback className="text-[10px]">{p.username[0]?.toUpperCase()}</AvatarFallback>}
                  </Avatar>
                  <span className="text-sm text-foreground" data-no-translate>{p.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
