import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const SUB_CATEGORIES = [
  "Affordability", "Natural Beauty", "Culture & Heritage", "Safety & Security",
  "Food", "Hospitality & People", "Weather", "Entertainment & Nightlife",
];

interface DiaryEntry {
  id: string;
  rating: number | null;
  liked: boolean;
  review_text: string | null;
  visit_year: number | null;
  visit_month: number | null;
  duration_days: number | null;
  place: {
    id: string;
    name: string;
    country: string;
    type: string;
    image: string | null;
  };
}

interface TaggedUser {
  user_id: string;
  username: string;
  profile_picture: string | null;
}

interface DiaryEditSheetProps {
  entry: DiaryEntry;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function DiaryEditSheet({ entry, open, onClose, onSaved }: DiaryEditSheetProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(entry.rating ? Number(entry.rating) : 0);
  const [liked, setLiked] = useState(entry.liked);
  const [reviewText, setReviewText] = useState(entry.review_text || "");
  const [visitYear, setVisitYear] = useState(entry.visit_year || new Date().getFullYear());
  const [visitMonth, setVisitMonth] = useState(entry.visit_month || 1);
  const [durationDays, setDurationDays] = useState<number | "">(entry.duration_days || "");
  const [unknownDate, setUnknownDate] = useState(!entry.visit_year && !entry.visit_month);
  const [saving, setSaving] = useState(false);

  // Sub-ratings
  const [subRatings, setSubRatings] = useState<Record<string, number>>({});

  // Tags
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<TaggedUser[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  // Load existing tags and sub-ratings
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingTags(true);
      const { data: tags } = await supabase
        .from("review_tags")
        .select("tagged_user_id")
        .eq("review_id", entry.id);

      if (tags && tags.length > 0) {
        const userIds = tags.map(t => t.tagged_user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", userIds);
        setTaggedUsers(profiles || []);
      } else {
        setTaggedUsers([]);
      }

      // Load sub-ratings
      const { data: subs } = await supabase
        .from("review_sub_ratings")
        .select("category, rating")
        .eq("review_id", entry.id);
      const sr: Record<string, number> = {};
      (subs || []).forEach(s => { sr[s.category] = Number(s.rating); });
      setSubRatings(sr);

      setLoadingTags(false);
    })();
  }, [entry.id, open]);

  // Reset form when entry changes
  useEffect(() => {
    setRating(entry.rating ? Number(entry.rating) : 0);
    setLiked(entry.liked);
    setReviewText(entry.review_text || "");
    setVisitYear(entry.visit_year || new Date().getFullYear());
    setVisitMonth(entry.visit_month || 1);
    setDurationDays(entry.duration_days || "");
    setUnknownDate(!entry.visit_year && !entry.visit_month);
  }, [entry]);

  // Tag search
  useEffect(() => {
    if (!tagQuery.trim()) { setTagResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, profile_picture")
        .ilike("username", `%${tagQuery}%`)
        .limit(10);
      const filtered = (data || []).filter(
        p => p.user_id !== user?.id && !taggedUsers.some(t => t.user_id === p.user_id)
      );
      setTagResults(filtered);
    }, 200);
    return () => clearTimeout(timer);
  }, [tagQuery, taggedUsers, user?.id]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("reviews")
      .update({
        rating: rating > 0 ? rating : null,
        liked,
        review_text: reviewText || null,
        visit_year: unknownDate ? null : visitYear,
        visit_month: unknownDate ? null : visitMonth,
        duration_days: durationDays || null,
      })
      .eq("id", entry.id);

    if (!error) {
      // Update tags: delete all existing, re-insert current
      await supabase.from("review_tags").delete().eq("review_id", entry.id);
      if (taggedUsers.length > 0) {
        await supabase.from("review_tags").insert(
          taggedUsers.map(t => ({
            review_id: entry.id,
            tagged_user_id: t.user_id,
            tagged_by_user_id: user.id,
          }))
        );
      }

      // Update sub-ratings: delete all existing, re-insert
      await supabase.from("review_sub_ratings").delete().eq("review_id", entry.id);
      const subEntries = Object.entries(subRatings).filter(([, v]) => v > 0);
      if (subEntries.length > 0) {
        await supabase.from("review_sub_ratings").insert(
          subEntries.map(([category, rating]) => ({
            review_id: entry.id,
            category,
            rating,
          }))
        );
      }

      toast.success("Entry updated");
      onSaved();
      onClose();
    } else {
      toast.error("Failed to update entry");
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card w-full max-w-lg rounded-t-2xl border border-border max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom">
        <div className="sticky top-0 bg-card z-10 flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Edit Entry</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-primary font-semibold text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Place info */}
          <div className="flex items-center gap-3">
            {entry.place.image ? (
              <img src={entry.place.image} alt={entry.place.name} className="w-12 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-muted" />
            )}
            <div>
              <p className="font-bold text-foreground">{entry.place.name}</p>
              <p className="text-xs text-muted-foreground">{entry.place.type === "city" ? entry.place.country : "Country"}</p>
            </div>
          </div>

          {/* Rating */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Your rating</p>
            <div className="flex items-center justify-between">
              <StarRating rating={rating} size={36} interactive onChange={setRating} />
              <button type="button" onClick={() => setLiked(!liked)} className="text-2xl">
                {liked ? "❤️" : "🤍"}
              </button>
            </div>
          </div>

          {/* Review */}
          <div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Add a review..."
              className="w-full h-28 bg-background rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Sub-category ratings */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Category Ratings</p>
            <div className="grid grid-cols-2 gap-3">
              {SUB_CATEGORIES.map((cat) => (
                <div key={cat} className="space-y-1">
                  <p className="text-[10px] text-muted-foreground leading-tight">{cat}</p>
                  <StarRating
                    rating={subRatings[cat] || 0}
                    size={16}
                    interactive
                    onChange={(val) => setSubRatings(prev => ({ ...prev, [cat]: val }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">When did you visit?</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-muted-foreground">I don't know</span>
                <input
                  type="checkbox"
                  checked={unknownDate}
                  onChange={(e) => setUnknownDate(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-card text-primary focus:ring-primary accent-primary"
                />
              </label>
            </div>
            {!unknownDate && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Year</label>
                  <select
                    value={visitYear}
                    onChange={(e) => setVisitYear(Number(e.target.value))}
                    className="w-full bg-background rounded-xl py-2.5 px-3 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Month</label>
                  <select
                    value={visitMonth}
                    onChange={(e) => setVisitMonth(Number(e.target.value))}
                    className="w-full bg-background rounded-xl py-2.5 px-3 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Duration</label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value ? Number(e.target.value) : "")}
                    placeholder="Days"
                    min={1}
                    className="w-full bg-background rounded-xl py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Tag people that visited with you...</p>
            {loadingTags ? (
              <div className="flex items-center justify-center h-8">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {taggedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {taggedUsers.map(u => (
                      <div key={u.user_id} className="flex items-center gap-1.5 bg-background border border-border rounded-full px-2.5 py-1">
                        <Avatar className="w-4 h-4">
                          {u.profile_picture ? <AvatarImage src={u.profile_picture} /> : <AvatarFallback className="text-[8px]">{u.username[0]?.toUpperCase()}</AvatarFallback>}
                        </Avatar>
                        <span className="text-xs font-medium text-foreground">{u.username}</span>
                        <button onClick={() => setTaggedUsers(prev => prev.filter(t => t.user_id !== u.user_id))} className="ml-0.5">
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                    placeholder="Search by username..."
                    className="w-full bg-background rounded-xl py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {tagResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-20 max-h-40 overflow-y-auto">
                      {tagResults.map(p => (
                        <button
                          key={p.user_id}
                          onClick={() => {
                            setTaggedUsers(prev => [...prev, p]);
                            setTagQuery("");
                            setTagResults([]);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                        >
                          <Avatar className="w-6 h-6">
                            {p.profile_picture ? <AvatarImage src={p.profile_picture} /> : <AvatarFallback className="text-[10px]">{p.username[0]?.toUpperCase()}</AvatarFallback>}
                          </Avatar>
                          <span className="text-sm text-foreground">{p.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
