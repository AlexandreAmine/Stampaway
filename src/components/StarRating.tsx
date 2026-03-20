import { Star, Heart } from "lucide-react";

interface StarRatingProps {
  rating: number | null;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  liked?: boolean;
}

export function StarRating({ rating, size = 16, interactive = false, onChange, liked }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  const displayRating = rating ?? 0;

  const handleClick = (star: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftHalf = clickX < rect.width / 2;
    const newRating = isLeftHalf ? star - 0.5 : star;
    onChange(displayRating === newRating ? 0 : newRating);
  };

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((star) => {
        const filled = displayRating >= star;
        const halfFilled = displayRating >= star - 0.5 && displayRating < star;

        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={(e) => handleClick(star, e)}
            className={`relative ${interactive ? "cursor-pointer" : "cursor-default"}`}
            style={{ width: size, height: size }}
          >
            <Star size={size} className="text-star-empty absolute inset-0" fill="none" />
            {halfFilled && (
              <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                <Star size={size} className="text-star fill-star" fill="currentColor" />
              </div>
            )}
            {filled && (
              <Star size={size} className="text-star fill-star absolute inset-0" fill="currentColor" />
            )}
          </button>
        );
      })}
      {liked && (
        <Heart
          size={size * 0.75}
          className="text-red-500 fill-red-500 ml-0.5 shrink-0"
        />
      )}
    </div>
  );
}
