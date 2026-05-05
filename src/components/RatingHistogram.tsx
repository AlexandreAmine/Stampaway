import { Star } from "lucide-react";
import { useState, useEffect } from "react";

interface RatingHistogramProps {
  distribution: number[]; // array of 10 counts for ratings 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5
  onBarClick?: (rating: number) => void;
}

export function RatingHistogram({ distribution, onBarClick }: RatingHistogramProps) {
  const maxCount = Math.max(...distribution, 1);
  const ratingForIndex = (i: number) => (i + 1) * 0.5;
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Auto-dismiss tooltip after a few seconds
  useEffect(() => {
    if (activeIdx === null) return;
    const t = setTimeout(() => setActiveIdx(null), 2000);
    return () => clearTimeout(t);
  }, [activeIdx]);

  return (
    <div className="flex items-end gap-[2px]">
      <Star size={12} className="text-star fill-star mb-0.5 mr-1 shrink-0" />
      {distribution.map((count, i) => {
        const height = count > 0 ? Math.max((count / maxCount) * 40, 4) : 4;
        const isActive = activeIdx === i;
        return (
          <div key={i} className="relative flex-1 min-w-[8px] flex flex-col items-center">
            {isActive && count > 0 && (
              <div className="absolute -top-6 px-1.5 py-0.5 rounded bg-foreground text-background text-[10px] font-medium whitespace-nowrap z-10">
                {count}
              </div>
            )}
            <button
              onClick={() => {
                if (count === 0) return;
                if (onBarClick) {
                  onBarClick(ratingForIndex(i));
                } else {
                  setActiveIdx(isActive ? null : i);
                }
              }}
              className={`w-full rounded-t-sm transition-all ${count > 0 ? "bg-muted-foreground/40 hover:bg-primary/60 cursor-pointer" : "bg-muted-foreground/20 cursor-default"}`}
              style={{ height: `${height}px` }}
              disabled={count === 0}
            />
          </div>
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
