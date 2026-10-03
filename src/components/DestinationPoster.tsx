import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { getFlagUrl } from "@/lib/countryFlags";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";
import { getDestinationPosterOverride } from "@/lib/countryPosterOverrides";
import { sizedPosterUrl } from "@/lib/imageSizing";
import { FadeInImage } from "@/components/FadeInImage";
import { FlagImage } from "@/components/CountryFlag";
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
  /**
   * CSS-pixel budget for the rendered image (a ~3x retina rendition is
   * requested from the CDN). Defaults to card size; heroes pass a larger
   * value. Only affects the CDN URL params — never the layout.
   */
  renderWidth?: number;
  /**
   * Above-the-fold posters: load eagerly with high fetch priority so the
   * first visible row appears as fast as possible on a cold cache.
   */
  priority?: boolean;
  /**
   * Load now rather than when scrolled near: for the first few posters of a
   * horizontal row, which are off-screen sideways and would otherwise show
   * blank and fade in as the row is swiped. Normal fetch priority.
   */
  eager?: boolean;
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
  renderWidth = 400,
  priority = false,
  eager = false,
}: DestinationPosterProps) {
  const overrideImage = getDestinationPosterOverride(name, type);
  const resolvedImage = overrideImage || image || null;

  const [imageUrl, setImageUrl] = useState(resolvedImage);
  const [loading, setLoading] = useState(false);
  // Tracks the photo itself: until it loads the placeholder shimmers (so a
  // slow download reads as loading, not broken); if it fails we fall back.
  // Keyed by URL rather than reset in an effect: a cached image can fire
  // `load` before a mount effect runs, and the reset would then undo it.
  const [photoResult, setPhotoResult] = useState<{ url: string; state: "loaded" | "failed" } | null>(null);
  const generatedRef = useRef(false);
  const activeRequestRef = useRef<DestinationPosterRequestToken | null>(null);

  useEffect(() => {
    generatedRef.current = false;
    activeRequestRef.current = null;
    setImageUrl(resolvedImage);
    setLoading(false);

    if (resolvedImage) {
      setCachedDestinationPosterUrl(placeId, provider, resolvedImage);
    }
  }, [resolvedImage, placeId, provider]);

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
  const photoState = imageUrl && photoResult?.url === imageUrl ? photoResult.state : "loading";
  const showPhoto = !!imageUrl && photoState !== "failed";
  // No photo at all (or it failed): a deliberate card with the flag, rather
  // than a near-black tile that looks like a failed load.
  // With autoGenerate, the first render happens before the fetch starts; show
  // the spinner rather than flashing the fallback for a frame.
  const awaitingGeneration = autoGenerate && !imageUrl && !generatedRef.current;
  const showFallback = !showPhoto && !loading && !awaitingGeneration;

  const localizedName = useLocalizedPlaceName(name, type === "country");
  const localizedCountry = useLocalizedPlaceName(country, true);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-card ${className}`}
      data-prefetch-place={placeId}
    >
      {showPhoto ? (
        <>
          {/* Gradient placeholder stays visible until the file has actually
              loaded; FadeInImage then fades the photo in on load (the old
              mount-timed fade finished before slow first-launch downloads
              arrived, so images popped in raw). */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-muted">
            {/* Nested: .skeleton-shimmer sets position: relative, which would
                override `absolute` if applied to the placeholder itself. */}
            {photoState === "loading" && <div className="w-full h-full skeleton-shimmer" />}
          </div>
          <FadeInImage
            key={imageUrl}
            src={sizedPosterUrl(imageUrl, renderWidth) || imageUrl}
            alt={localizedName}
            loading={priority || eager ? "eager" : "lazy"}
            decoding="async"
            {...(priority ? ({ fetchpriority: "high" } as Record<string, string>) : {})}
            onLoad={() => setPhotoResult({ url: imageUrl, state: "loaded" })}
            onError={() => setPhotoResult({ url: imageUrl, state: "failed" })}
            className="relative w-full h-full object-cover"
          />
        </>
      ) : showFallback ? (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/45 via-primary/20 to-card">
          {flagUrl && (
            <FlagImage
              src={getFlagUrl(flagCountry, 160) ?? flagUrl}
              alt={flagCountry}
              className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-[42%] aspect-[7/5] rounded-md shadow-lg object-cover ring-1 ring-white/20"
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-muted flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}

      {!bare && (
        <>
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Country flag - top right (the fallback card already shows it large) */}
          {flagUrl && !showFallback && (
            <FlagImage
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
