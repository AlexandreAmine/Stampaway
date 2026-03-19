import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { places, reviews } from "@/data/mockData";
import { PlaceCard } from "@/components/PlaceCard";
import { ReviewCard } from "@/components/ReviewCard";

const tabs = ["Places", "Reviews", "Lists"];

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState("Places");

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        {/* Tabs */}
        <div className="flex items-center gap-6 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative pb-2"
            >
              <span
                className={`text-lg font-semibold transition-colors ${
                  activeTab === tab ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="explore-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Trending */}
        <div className="mb-6">
          <div className="flex items-center gap-1 mb-3">
            <h2 className="text-lg font-bold text-foreground">Trending this week</h2>
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {places.slice(0, 4).map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        </div>

        {/* New from friends */}
        <div>
          <div className="flex items-center gap-1 mb-3">
            <h2 className="text-lg font-bold text-foreground">New from friends</h2>
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
          <div className="space-y-4">
            {reviews.slice(0, 2).map((review) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ReviewCard review={review} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
