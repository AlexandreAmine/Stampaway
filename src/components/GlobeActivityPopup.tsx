import { Star, Calendar, Clock, MessageSquare, X } from "lucide-react";
import { getFlagEmoji } from "@/lib/countryFlags";
import { motion, AnimatePresence } from "framer-motion";

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

export function GlobeActivityPopup({ activity, onClose, onNavigate }: GlobeActivityPopupProps) {
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

          {/* Review text preview */}
          {activity.review_text && (
            <div className="flex items-start gap-1.5 mt-2">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground line-clamp-2">{activity.review_text}</p>
            </div>
          )}

          {/* Tap hint */}
          <p className="text-[10px] text-muted-foreground/50 text-center mt-3">Tap destination to view details</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
