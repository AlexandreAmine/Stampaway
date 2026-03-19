import { Star } from "lucide-react";

interface RatingHistogramProps {
  distribution: number[]; // array of 10 counts for ratings 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5
}

export function RatingHistogram({ distribution }: RatingHistogramProps) {
  const maxCount = Math.max(...distribution, 1);

  return (
    <div className="flex items-end gap-[2px]">
      <Star size={12} className="text-star fill-star mb-0.5 mr-1 shrink-0" />
      {distribution.map((count, i) => {
        const height = count > 0 ? Math.max((count / maxCount) * 40, 4) : 4;
        return (
          <div
            key={i}
            className="flex-1 min-w-[8px] rounded-t-sm bg-muted-foreground/40 transition-all"
            style={{ height: `${height}px` }}
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
