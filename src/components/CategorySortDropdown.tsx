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
import { useLanguage } from "@/contexts/LanguageContext";
import { SUB_CATEGORIES, subCategoryLabel, type SubCategory } from "@/lib/subCategories";

export type SubRatingCategory = SubCategory;

interface CategorySortDropdownProps {
  label: string;
  onSelect: (category: SubRatingCategory) => void;
  selectedCategory?: SubRatingCategory | null;
  isActive?: boolean;
}

export function CategorySortDropdown({ label, onSelect, selectedCategory, isActive }: CategorySortDropdownProps) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
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
          {SUB_CATEGORIES.map((cat) => (
            <DropdownMenuItem
              key={cat}
              onClick={() => onSelect(cat)}
              className={selectedCategory === cat && isActive ? "text-primary font-semibold" : ""}
            >
              {subCategoryLabel(cat, t)}
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
        {t("back")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {SUB_CATEGORIES.map((cat) => (
        <DropdownMenuItem
          key={cat}
          onClick={() => {
            onSelect(cat);
            setExpanded(false);
          }}
          className={selectedCategory === cat && isActive ? "text-primary font-semibold" : ""}
        >
          {subCategoryLabel(cat, t)}
        </DropdownMenuItem>
      ))}
    </>
  );
}
