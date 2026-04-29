import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getFlagUrl } from "@/lib/countryFlags";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";

interface DestinationPosterProps {
  placeId: string;
  name: string;
  country: string;
  type: "city" | "country";
  image?: string | null;
  className?: string;
  autoGenerate?: boolean;
  onImageGenerated?: (url: string) => void;
  provider?: "unsplash" | "pexels";
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
}: DestinationPosterProps) {
  const [imageUrl, setImageUrl] = useState(image || null);
  const [loading, setLoading] = useState(false);
  const generatedRef = useRef(false);

  useEffect(() => {
    setImageUrl(image || null);
  }, [image]);

  useEffect(() => {
    if (autoGenerate && !imageUrl && !loading && !generatedRef.current) {
      generatedRef.current = true;
      generatePoster();
    }
  }, [autoGenerate, imageUrl]);

  const generatePoster = async () => {
    setLoading(true);
    try {
      const fnName = provider === "pexels" ? "fetch-pexels-poster" : "fetch-unsplash-poster";
      const { data, error } = await supabase.functions.invoke(
        fnName,
        { body: { place_id: placeId } }
      );
      if (data?.image_url) {
        setImageUrl(data.image_url);
        onImageGenerated?.(data.image_url);
      }
      if (error) console.error("Poster generation error:", error);
    } catch (e) {
      console.error("Failed to generate poster:", e);
    }
    setLoading(false);
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
          className="w-full h-full object-cover"
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
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-sm font-bold text-white leading-tight truncate">
          {localizedName}
        </p>
        {type === "city" && (
          <p className="text-[10px] text-white/70 truncate">{localizedCountry}</p>
        )}
      </div>
    </div>
  );
}
