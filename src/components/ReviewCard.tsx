import { Star } from "lucide-react";
import type { Review } from "@/data/mockData";

interface ReviewCardProps {
  review: Review;
  showImage?: boolean;
}

export function ReviewCard({ review, showImage = true }: ReviewCardProps) {
  return (
    <div className="bg-card rounded-2xl overflow-hidden">
      {showImage && (
        <div className="relative h-48">
          <img src={review.placeImage} alt={review.placeName} className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3">
            <p className="text-lg font-bold text-foreground drop-shadow-lg">{review.placeName}</p>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={review.userAvatar}
            alt={review.userName}
            className="w-8 h-8 rounded-full object-cover"
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{review.userName}</p>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-star fill-star" />
              <span className="text-xs font-medium text-foreground">{review.rating}</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{review.createdAt}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">{review.reviewText}</p>
      </div>
    </div>
  );
}
