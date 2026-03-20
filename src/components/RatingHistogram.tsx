import { Star } from "lucide-react";

interface RatingHistogramProps {
  distribution: number[]; // array of 10 counts for ratings 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5
  onBarClick?: (rating: number) => void;
}

export function RatingHistogram({ distribution, onBarClick }: RatingHistogramProps) {
  const maxCount = Math.max(...distribution, 1);
  // Rating values: 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5
  const ratingForIndex = (i: number) => (i + 1) * 0.5;

  return (
    <div className="flex items-end gap-[2px]">
      <Star size={12} className="text-star fill-star mb-0.5 mr-1 shrink-0" />
      {distribution.map((count, i) => {
        const height = count > 0 ? Math.max((count / maxCount) * 40, 4) : 4;
        return (
          <button
            key={i}
            onClick={() => count > 0 && onBarClick?.(ratingForIndex(i))}
            className={`flex-1 min-w-[8px] rounded-t-sm transition-all ${count > 0 ? "bg-muted-foreground/40 hover:bg-primary/60 cursor-pointer" : "bg-muted-foreground/20 cursor-default"}`}
            style={{ height: `${height}px` }}
            disabled={count === 0}
          />
        );
      })}
      <div className="flex items-center gap-0 ml-1 mb-0.5 shrink-0">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} size={12} className="text-star fill-star" />
        ))}
      </div>
    </div>
  );
}
