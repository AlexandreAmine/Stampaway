import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function StarRating({ rating, size = 16, interactive = false, onChange }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((star) => {
        const filled = rating >= star;
        const halfFilled = rating >= star - 0.5 && rating < star;

        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => {
              if (interactive && onChange) {
                onChange(rating === star ? star - 0.5 : star);
              }
            }}
            className={interactive ? "cursor-pointer" : "cursor-default"}
          >
            <Star
              size={size}
              className={`${
                filled || halfFilled ? "text-star fill-star" : "text-star-empty"
              } transition-colors`}
              fill={filled ? "currentColor" : halfFilled ? "currentColor" : "none"}
            />
          </button>
        );
      })}
    </div>
  );
}
