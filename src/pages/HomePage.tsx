import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { reviews } from "@/data/mockData";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="pt-12 pb-4 px-5 text-center">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">TravelD</h1>
      </div>

      {/* Globe placeholder */}
      <div className="relative mx-auto w-full max-w-sm aspect-square flex items-center justify-center">
        <div className="w-64 h-64 rounded-full bg-gradient-to-br from-primary/20 via-secondary to-primary/10 border border-border flex items-center justify-center">
          <span className="text-6xl">🌍</span>
        </div>
        {/* Floating pins */}
        {[
          { top: "15%", left: "50%", rating: 4.5 },
          { top: "30%", left: "20%", rating: 4.5 },
          { top: "25%", left: "40%", rating: 10 },
          { top: "28%", left: "70%", rating: 4.5 },
          { top: "40%", left: "55%", rating: 4.5 },
          { top: "50%", right: "15%", rating: 6 },
          { top: "70%", left: "50%", rating: 4.5 },
        ].map((pin, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
            className="absolute glass-card rounded-full px-2 py-1 flex items-center gap-1"
            style={{ top: pin.top, left: pin.left, right: (pin as any).right }}
          >
            <div className="w-5 h-5 rounded-full bg-muted overflow-hidden">
              <img src={`https://i.pravatar.cc/40?img=${i + 10}`} alt="" className="w-full h-full object-cover" />
            </div>
            <Star className="w-3 h-3 text-star fill-star" />
            <span className="text-xs font-semibold text-foreground">{pin.rating}</span>
          </motion.div>
        ))}
      </div>

      {/* Friends activities */}
      <div className="px-5 mt-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Friends activities</h2>
        <div className="space-y-3">
          {reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 py-2"
            >
              <img
                src={review.userAvatar}
                alt={review.userName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-foreground">{review.userName}</span>
                  <span className="text-xs text-muted-foreground">• {review.createdAt}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground">{review.placeName}</span>
                  <Star className="w-3 h-3 text-star fill-star" />
                  <span className="text-sm font-medium text-foreground">{review.rating}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
