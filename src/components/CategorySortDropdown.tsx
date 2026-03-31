import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

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
