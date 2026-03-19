import { useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { recentSearches, places } from "@/data/mockData";
import { StarRating } from "@/components/StarRating";

type Step = "search" | "review";

export default function AddPlacePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const filteredSearches = query
    ? recentSearches.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    : recentSearches;

  const handleSelectPlace = (name: string) => {
    setSelectedPlace(name);
    setStep("review");
  };

  const handleSave = () => {
    navigate("/profile");
  };

  if (step === "review" && selectedPlace) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("search")}>
                <ChevronLeft className="w-6 h-6 text-foreground" />
              </button>
              <div>
                <p className="text-xs text-muted-foreground">I TravelD to...</p>
                <h1 className="text-xl font-bold text-foreground">{selectedPlace}</h1>
              </div>
            </div>
            <button onClick={handleSave} className="text-primary font-semibold text-sm">
              Save
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                How do you rate this destination?
              </p>
              <StarRating rating={rating} size={40} interactive onChange={setRating} />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                How was your experience there?
              </p>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Tell us about your experience..."
                className="w-full h-32 bg-card rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-semibold text-foreground">Date</span>
              <span className="text-sm text-primary">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-border">
              <span className="text-sm font-semibold text-foreground">Like</span>
              <button className="text-muted-foreground">♡</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Add a Destination</h1>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location..."
            className="w-full bg-card rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <p className="text-xs font-medium text-muted-foreground mb-3">Recent Searches</p>
        <div className="space-y-0">
          {filteredSearches.map((search) => (
            <motion.button
              key={search}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => handleSelectPlace(search)}
              className="w-full text-left py-3.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {search}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
