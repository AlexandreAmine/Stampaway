import { Globe, Map, Search, User, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", label: "Friends", icon: Globe },
  { path: "/explore", label: "Explore", icon: Map },
  { path: "/add", label: "Add", icon: Plus, isCenter: true },
  { path: "/search", label: "Search", icon: Search },
  { path: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="relative -mt-4"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
                >
                  <Icon className="w-7 h-7 text-primary-foreground" />
                </motion.div>
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-1 py-2 px-3 relative"
            >
              <Icon
                className={`w-5 h-5 transition-colors ${isActive ? "text-nav-active" : "text-nav-inactive"}`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${isActive ? "text-nav-active" : "text-nav-inactive"}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
