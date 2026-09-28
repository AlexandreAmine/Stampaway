import { DestinationPoster } from "@/components/DestinationPoster";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCachedPlaceName } from "@/lib/placeNames";
import { CountryFlag } from "@/components/CountryFlag";

/** Shape saved in localStorage "recentSearches"; older entries may only have id + name. */
export interface RecentPlace {
  id: string;
  name: string;
  country?: string;
  type?: string;
  image?: string | null;
}

interface Props {
  places: RecentPlace[];
  onSelect: (place: RecentPlace) => void;
  onPressStart?: (place: RecentPlace) => void;
}

/** Compact rows (thumbnail, name, flag + country) shared by Search and Add. */
export function RecentSearches({ places, onSelect, onPressStart }: Props) {
  const { t, language } = useLanguage();

  return (
    <div className="mb-6">
      <p className="text-xs text-muted-foreground mb-2">{t("search.recentSearches")}</p>
      <div>
        {places.map((place) => {
          const isCountry = place.type === "country";
          const isCity = place.type === "city";
          const flagCountry = isCountry ? place.name : place.country;
          const subtitle = isCity && place.country
            ? getCachedPlaceName(place.country, language, true)
            : isCountry
            ? t("common.country")
            : null;

          return (
            <button
              key={place.id}
              onTouchStart={onPressStart ? () => onPressStart(place) : undefined}
              onClick={() => onSelect(place)}
              className="w-full flex items-center gap-3 py-1.5 text-left active:opacity-60 transition-opacity"
            >
              <div className="w-9 h-12 shrink-0 rounded-lg overflow-hidden">
                <DestinationPoster
                  placeId={place.id}
                  name={place.name}
                  country={place.country ?? ""}
                  type={isCity ? "city" : "country"}
                  image={place.image ?? null}
                  renderWidth={48}
                  bare
                  className="w-full h-full !rounded-lg"
                />
              </div>
              <div className="min-w-0 flex-1" data-no-translate>
                <p className="text-sm font-semibold text-foreground truncate">
                  {getCachedPlaceName(place.name, language, isCountry)}
                </p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    <CountryFlag country={flagCountry} className="w-4 h-3" />
                    {subtitle}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
