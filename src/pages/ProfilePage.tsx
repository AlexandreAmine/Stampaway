import { useState } from "react";
import { Settings, ChevronRight, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { places, ratingDistribution, travelLists } from "@/data/mockData";
import { PlaceCard } from "@/components/PlaceCard";

const profileTabs = ["Profile", "Diary", "Lists", "Wishlist"];

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("Profile");

  const maxCount = Math.max(...ratingDistribution.map((d) => d.count));

  const displayName = profile?.username || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3B82F6&color=fff`;

  const stats = [
    { label: "Countries", value: 0 },
    { label: "Cities", value: 0 },
    { label: "Reviews", value: 0 },
    { label: "Lists", value: 0 },
    { label: "Wishlist", value: 0 },
    { label: "Following", value: 0 },
    { label: "Followers", value: 0 },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-border"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <button onClick={signOut} className="p-2">
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-5 mb-6">
          {profileTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative pb-2"
            >
              <span
                className={`text-sm font-semibold transition-colors ${
                  activeTab === tab ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="profile-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === "Profile" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Favorite Cities */}
            <div className="mb-6">
              <div className="flex items-center gap-1 mb-3">
                <h2 className="text-lg font-bold text-foreground">Favorite Cities</h2>
                <ChevronRight className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
                {places.slice(0, 4).map((place) => (
                  <PlaceCard key={place.id} place={place} variant="small" />
                ))}
              </div>
            </div>

            {/* Rating distribution */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Rating Distribution</h2>
              <div className="space-y-2 mb-6">
                {ratingDistribution.map((item) => (
                  <div key={item.stars} className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 w-8">
                      <span className="text-xs text-star">★</span>
                      <span className="text-xs font-medium text-foreground">{item.stars}</span>
                    </div>
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / maxCount) * 100}%` }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="h-full bg-primary rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats list */}
            <div className="space-y-0">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between py-3 border-b border-border"
                >
                  <span className="text-sm font-semibold text-foreground">{stat.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">{stat.value}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "Lists" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {travelLists.map((list) => (
              <div key={list.id} className="bg-card rounded-2xl overflow-hidden">
                <div className="relative h-32">
                  <img src={list.coverImage} alt={list.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <p className="text-base font-bold text-foreground">{list.name}</p>
                    <p className="text-xs text-muted-foreground">{list.placeCount} places</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {(activeTab === "Diary" || activeTab === "Wishlist") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center h-40"
          >
            <p className="text-muted-foreground text-sm">Coming soon</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
