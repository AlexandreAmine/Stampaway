import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

export const SUB_RATING_CATEGORIES = [
  "Affordability",
  "Natural Beauty",
  "Culture & Heritage",
  "Safety & Security",
  "Food",
  "Hospitality & People",
  "Weather",
  "Entertainment & Nightlife",
] as const;

export type SubRatingCategory = (typeof SUB_RATING_CATEGORIES)[number];

interface CategorySortDropdownProps {
  label: string;
  onSelect: (category: SubRatingCategory) => void;
  selectedCategory?: SubRatingCategory | null;
  isActive?: boolean;
}

export function CategorySortDropdown({ label, onSelect, selectedCategory, isActive }: CategorySortDropdownProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);

  if (!isMobile) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={isActive ? "text-primary font-semibold" : ""}>
          {label}
          {selectedCategory && isActive && (
            <span className="ml-1 text-xs text-muted-foreground">({selectedCategory})</span>
          )}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[200px]">
          {SUB_RATING_CATEGORIES.map((cat) => (
            <DropdownMenuItem
              key={cat}
              onClick={() => onSelect(cat)}
              className={selectedCategory === cat && isActive ? "text-primary font-semibold" : ""}
            >
              {cat}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  // Mobile: inline drill-down to avoid off-screen submenu positioning
  if (!expanded) {
    return (
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setExpanded(true);
        }}
        className={isActive ? "text-primary font-semibold" : ""}
      >
        <span className="flex-1">{label}</span>
        {selectedCategory && isActive && (
          <span className="mx-1 text-xs text-muted-foreground">({selectedCategory})</span>
        )}
        <ChevronRight className="ml-auto h-4 w-4" />
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setExpanded(false);
        }}
        className="text-muted-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {SUB_RATING_CATEGORIES.map((cat) => (
        <DropdownMenuItem
          key={cat}
          onClick={() => {
            onSelect(cat);
            setExpanded(false);
          }}
          className={selectedCategory === cat && isActive ? "text-primary font-semibold" : ""}
        >
          {cat}
        </DropdownMenuItem>
      ))}
    </>
  );
}
