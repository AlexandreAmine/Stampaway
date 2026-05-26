import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { getFlagUrl } from "@/lib/countryFlags";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";
import {
  fetchDestinationPosterUrl,
  getCachedDestinationPosterUrl,
  getDestinationPosterRequestToken,
  isDestinationPosterRequestTokenCurrent,
  setCachedDestinationPosterUrl,
  type DestinationPosterProvider,
  type DestinationPosterRequestToken,
} from "@/lib/destinationPosterCache";

interface DestinationPosterProps {
  placeId: string;
  name: string;
  country: string;
  type: "city" | "country";
  image?: string | null;
  className?: string;
  autoGenerate?: boolean;
  onImageGenerated?: (url: string) => void;
  provider?: DestinationPosterProvider;
  bare?: boolean;
}

export function DestinationPoster({
  placeId,
  name,
  country,
  type,
  image,
  className = "",
  autoGenerate = false,
  onImageGenerated,
  provider = "unsplash",
  bare = false,
}: DestinationPosterProps) {
  const [imageUrl, setImageUrl] = useState(image || null);
  const [loading, setLoading] = useState(false);
  const generatedRef = useRef(false);
  const activeRequestRef = useRef<DestinationPosterRequestToken | null>(null);

  useEffect(() => {
    generatedRef.current = false;
    activeRequestRef.current = null;
    setImageUrl(image || null);
    setLoading(false);

    if (image) {
      setCachedDestinationPosterUrl(placeId, provider, image);
    }
  }, [image, placeId, provider]);

  useEffect(() => {
    if (autoGenerate && !imageUrl && !loading && !generatedRef.current) {
      const cached = getCachedDestinationPosterUrl(placeId, provider);
      if (cached) {
        generatedRef.current = true;
        activeRequestRef.current = null;
        setImageUrl(cached);
        return;
      }

      generatedRef.current = true;
      generatePoster();
    }
  }, [autoGenerate, imageUrl, loading, placeId, provider]);

  const generatePoster = async () => {
    const token = getDestinationPosterRequestToken(placeId, provider);
    activeRequestRef.current = token;
    setLoading(true);

    try {
      const result = await fetchDestinationPosterUrl(placeId, provider, token);
      if (
        result.url &&
        activeRequestRef.current === token &&
        isDestinationPosterRequestTokenCurrent(placeId, provider, token)
      ) {
        setImageUrl(result.url);
        if (!result.fromCache) {
          onImageGenerated?.(result.url);
        }
      }
    } catch (e) {
      console.error("Failed to generate poster:", e);
    } finally {
      if (activeRequestRef.current === token) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  };

  const flagCountry = type === "country" ? name : country;
  const flagUrl = getFlagUrl(flagCountry, 40);

  const localizedName = useLocalizedPlaceName(name, type === "country");
  const localizedCountry = useLocalizedPlaceName(country, true);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-card ${className}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={localizedName}
          className="w-full h-full object-cover animate-in fade-in duration-500"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-muted flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20" />
          )}
        </div>
      )}

      {!bare && (
        <>
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Country flag - top right */}
          {flagUrl && (
            <img
              src={flagUrl}
              alt={flagCountry}
              className="absolute top-2 right-2 w-7 h-5 rounded-sm shadow-lg object-cover border border-white/20"
            />
          )}

          {/* Destination name - bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-2.5" data-no-translate>
            <p className="text-sm font-bold text-white leading-tight truncate">
              {localizedName}
            </p>
            {type === "city" && (
              <p className="text-[10px] text-white/70 truncate">{localizedCountry}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
