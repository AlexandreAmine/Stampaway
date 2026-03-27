import { Globe, Map, Search, User, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useRef, useCallback } from "react";

const tabs = [
  { path: "/", label: "Friends", icon: Globe },
  { path: "/explore", label: "Explore", icon: Map },
  { path: "/add", label: "Add", icon: Plus, isCenter: true },
  { path: "/search", label: "Search", icon: Search },
  { path: "/profile", label: "Profile", icon: User },
];

// Map any pathname to its root tab
function getTabRoot(pathname: string): string | null {
  if (pathname === "/" || pathname.startsWith("/review") || pathname.startsWith("/place") || pathname.startsWith("/country") || pathname.startsWith("/list") || pathname.startsWith("/logged-places")) return "/";
  if (pathname.startsWith("/explore")) return "/explore";
  if (pathname.startsWith("/add")) return "/add";
  if (pathname.startsWith("/search")) return "/search";
  if (pathname.startsWith("/profile")) return "/profile";
  return null;
}

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabHistory = useRef<Record<string, string>>({
    "/": "/",
    "/explore": "/explore",
    "/add": "/add",
    "/search": "/search",
    "/profile": "/profile",
  });

  // Track current location to its tab
  useEffect(() => {
    const tabRoot = getTabRoot(location.pathname);
    if (tabRoot) {
      tabHistory.current[tabRoot] = location.pathname + location.search;
    }
  }, [location.pathname, location.search]);

  const handleTabClick = useCallback((tabPath: string) => {
    const currentTabRoot = getTabRoot(location.pathname);

    if (currentTabRoot === tabPath) {
      // Clicking the same tab → reset to root
      tabHistory.current[tabPath] = tabPath;
      navigate(tabPath);
    } else {
      // Switching tabs → restore last URL for that tab
      const savedPath = tabHistory.current[tabPath] || tabPath;
      navigate(savedPath);
    }
  }, [location.pathname, navigate]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const currentTabRoot = getTabRoot(location.pathname);
          const isActive = currentTabRoot === tab.path;
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <button
                key={tab.path}
                onClick={() => handleTabClick(tab.path)}
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
              onClick={() => handleTabClick(tab.path)}
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
