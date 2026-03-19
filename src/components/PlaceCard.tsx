import { Star } from "lucide-react";
import type { Place } from "@/data/mockData";

interface PlaceCardProps {
  place: Place;
  variant?: "trending" | "small";
}

export function PlaceCard({ place, variant = "trending" }: PlaceCardProps) {
  if (variant === "small") {
    return (
      <div className="relative w-[130px] h-[170px] rounded-2xl overflow-hidden flex-shrink-0">
        <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <p className="text-sm font-semibold text-foreground">{place.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-[180px] h-[240px] rounded-2xl overflow-hidden flex-shrink-0">
      <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
      <div className="absolute bottom-3 left-3 right-3">
        <p className="text-xs text-muted-foreground">{place.country}</p>
        <p className="text-base font-bold text-foreground">{place.name}</p>
        <div className="flex items-center gap-1 mt-1">
          <Star className="w-3 h-3 text-star fill-star" />
          <span className="text-xs font-medium text-foreground">
            {place.rating}
          </span>
          <span className="text-xs text-muted-foreground">
            ({place.reviewCount >= 1000 ? `${Math.round(place.reviewCount / 1000)}k` : place.reviewCount})
          </span>
        </div>
      </div>
    </div>
  );
}
