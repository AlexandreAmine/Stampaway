import { useState } from "react";
import { getFlagUrl } from "@/lib/countryFlags";

/**
 * Flags are bundled with the app (see getFlagUrl), so they normally load at
 * once; still, a bordered <img> that hasn't decoded yet renders as an empty
 * outlined box, so keep it invisible until loaded and drop it on error.
 */
export function FlagImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  // Keyed by URL (not reset in an effect): cached flags fire `load` before
  // mount effects run, and a reset there left them invisible for good.
  const [result, setResult] = useState<{ src: string; state: "loaded" | "failed" } | null>(null);
  const state = result?.src === src ? result.state : "loading";
  if (state === "failed") return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setResult({ src, state: "loaded" })}
      onError={() => setResult({ src, state: "failed" })}
      className={`${className} transition-opacity duration-200 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
    />
  );
}

/**
 * Inline flag for rows and chips — the same flag images the posters use, so
 * flags look alike everywhere (they used to be emoji in lists).
 */
export function CountryFlag({ country, className = "w-[18px] h-[13px]" }: { country: string | null | undefined; className?: string }) {
  const src = country ? getFlagUrl(country, 40) : null;
  if (!src) return null;
  return (
    <FlagImage
      src={src}
      alt={country!}
      className={`${className} inline-block shrink-0 rounded-[3px] object-cover align-[-2px]`}
    />
  );
}
