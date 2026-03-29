import { useState, useEffect } from "react";
import { Star, Calendar, Clock, MessageSquare, X, Users } from "lucide-react";
import { getFlagEmoji } from "@/lib/countryFlags";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface GlobeActivityPopupProps {
  activity: {
    id: string;
    user_id: string;
    username: string;
    profile_picture: string | null;
    place_id: string;
    place_name: string;
    place_country: string;
    place_type: string;
    rating: number | null;
    created_at: string;
    visit_month: number | null;
    visit_year: number | null;
    duration_days: number | null;
    review_text: string | null;
  } | null;
  onClose: () => void;
  onNavigate: () => void;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface TaggedPerson {
  username: string;
  profile_picture: string | null;
}

interface Comment {
  id: string;
  comment_text: string;
  username: string;
}

export function GlobeActivityPopup({ activity, onClose, onNavigate }: GlobeActivityPopupProps) {
  const [taggedPeople, setTaggedPeople] = useState<TaggedPerson[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!activity) { setTaggedPeople([]); setComments([]); return; }

    // Fetch tagged people
    (async () => {
      const { data: tags } = await supabase
        .from("review_tags")
        .select("tagged_user_id")
        .eq("review_id", activity.id);
      if (tags && tags.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", tags.map(t => t.tagged_user_id));
        setTaggedPeople((profiles || []).map(p => ({ username: p.username, profile_picture: p.profile_picture })));
      } else {
        setTaggedPeople([]);
      }
    })();

    // Fetch comments
    (async () => {
      const { data: cmts } = await supabase
        .from("review_comments")
        .select("id, comment_text, user_id")
        .eq("review_id", activity.id)
        .order("created_at", { ascending: true })
        .limit(3);
      if (cmts && cmts.length > 0) {
        const userIds = [...new Set(cmts.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", userIds);
        const pMap = new Map((profiles || []).map(p => [p.user_id, p.username]));
        setComments(cmts.map(c => ({ id: c.id, comment_text: c.comment_text, username: pMap.get(c.user_id) || "User" })));
      } else {
        setComments([]);
      }
    })();
  }, [activity?.id]);

  if (!activity) return null;

  const flag = getFlagEmoji(activity.place_country);
  const avatarUrl = activity.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(activity.username)}&background=3B82F6&color=fff&size=40`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-4"
      >
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xl backdrop-blur-sm">
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* User info row */}
          <div className="flex items-center gap-2 mb-3">
            <img src={avatarUrl} alt={activity.username} className="w-8 h-8 rounded-full object-cover" />
            <span className="text-sm font-semibold text-foreground">{activity.username}</span>
          </div>

          {/* Destination */}
          <button onClick={onNavigate} className="w-full text-left">
            <div className="flex items-center gap-2 mb-2">
              {flag && <span className="text-lg">{flag}</span>}
              <h3 className="text-lg font-bold text-foreground">{activity.place_name}</h3>
            </div>
            {activity.place_type === "city" && (
              <p className="text-xs text-muted-foreground -mt-1 mb-2 ml-8">{activity.place_country}</p>
            )}
          </button>

          {/* Info chips */}
          <div className="flex flex-wrap gap-2 mb-2">
            {activity.rating != null && (
              <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1">
                <Star className="w-3.5 h-3.5 fill-primary" />
                <span className="text-sm font-bold">{activity.rating}</span>
              </div>
            )}
            {activity.visit_month != null && activity.visit_year != null && (
              <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{monthNames[activity.visit_month - 1]} {activity.visit_year}</span>
              </div>
            )}
            {activity.duration_days != null && (
              <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{activity.duration_days}d</span>
              </div>
            )}
          </div>

          {/* Tagged people */}
          {taggedPeople.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground">with</span>
                {taggedPeople.map((p, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Avatar className="w-4 h-4">
                      {p.profile_picture ? <AvatarImage src={p.profile_picture} /> : <AvatarFallback className="text-[7px]">{p.username[0]?.toUpperCase()}</AvatarFallback>}
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{p.username}</span>
                    {i < taggedPeople.length - 1 && <span className="text-xs text-muted-foreground">,</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review text preview */}
          {activity.review_text && (
            <div className="flex items-start gap-1.5 mt-2">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground line-clamp-2">{activity.review_text}</p>
            </div>
          )}

          {/* Comments */}
          {comments.length > 0 && (
            <div className="mt-2 space-y-1">
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-1.5">
                  <MessageSquare className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    <span className="font-semibold text-foreground">{c.username}</span> {c.comment_text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Tap hint */}
          <p className="text-[10px] text-muted-foreground/50 text-center mt-3">Tap destination to view details</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
