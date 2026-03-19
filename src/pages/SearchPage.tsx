import { useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const filterTabs = ["Destinations", "Lists", "Users", "Reviews"];
const browseOptions = [
  "Trending destinations",
  "Most visited",
  "Highest rated",
  "Genre or region",
  "Based on destinations you like",
  "Most affordable",
  "Most liked lists",
];

export default function SearchPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("Destinations");
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Search</h1>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destinations, users, reviews..."
            className="w-full bg-card rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === tab
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Browse by */}
        <p className="text-xs font-medium text-muted-foreground mb-3">Browse by</p>
        <div className="space-y-0">
          {browseOptions.map((option, i) => (
            <motion.button
              key={option}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="w-full text-left py-3.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {option}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
