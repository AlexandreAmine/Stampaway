import { Globe, Map, Search, User, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const tabs = [
  { path: "/", label: "Friends", icon: Globe },
  { path: "/explore", label: "Explore", icon: Map },
  { path: "/add", label: "Add", icon: Plus, isCenter: true },
  { path: "/search", label: "Search", icon: Search },
  { path: "/profile", label: "Profile", icon: User },
];

const ACTIVE_TAB_STORAGE_KEY = "traveld-active-tab";

// Shared routes that should stay inside the current tab context
const SHARED_ROUTES = ["/review", "/place", "/country", "/list", "/logged-places", "/profile/"];

function getStoredActiveTab(): string {
  if (typeof window === "undefined") return "/";

  const storedTab = window.sessionStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
  return tabs.some((tab) => tab.path === storedTab) ? storedTab! : "/";
}

function isSharedRoute(pathname: string): boolean {
  return SHARED_ROUTES.some(r => pathname.startsWith(r));
}

// Map any pathname to its root tab (returns null for shared routes)
function getOwnTabRoot(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/explore")) return "/explore";
  if (pathname.startsWith("/add")) return "/add";
  if (pathname.startsWith("/search")) return "/search";
  if (pathname === "/profile" || pathname.startsWith("/settings")) return "/profile";
  return null;
}

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const ownTab = getOwnTabRoot(window.location.pathname);
    return ownTab || getStoredActiveTab();
  });

  useEffect(() => {
    const ownTab = getOwnTabRoot(location.pathname);
    if (ownTab) {
      setActiveTab(ownTab);
      window.sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, ownTab);
    } else if (isSharedRoute(location.pathname)) {
      setActiveTab(getStoredActiveTab());
    }
  }, [location.pathname]);

  const handleTabClick = (tabPath: string) => {
    setActiveTab(tabPath);
    window.sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tabPath);

    if (location.pathname !== tabPath) {
      navigate(tabPath);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.path;
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
