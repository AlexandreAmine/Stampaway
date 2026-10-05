/**
 * Rewrite stock-photo CDN URLs (Unsplash / Pexels) to request a smaller
 * rendition for card-sized contexts. Same photo and crop, far fewer pixels
 * to download and decode — poster URLs are stored at 900×1200, while cards
 * render at ~130–180 CSS px.
 *
 * Any other host (user uploads, overrides, local assets) is returned as-is.
 */
// Posters bundled with the app (see lib/countryPosterOverrides) come in three
// widths; pick the smallest one that still covers the requested width.
const BUNDLED_POSTER = /\/posters\/w(200|450|900)\/([^/]+\.jpg)$/;
const BUNDLED_WIDTHS = [200, 450, 900];

export function sizedPosterUrl(
  url: string | null | undefined,
  width: number
): string | null {
  if (!url) return null;

  const bundled = url.match(BUNDLED_POSTER);
  if (bundled) {
    const best = BUNDLED_WIDTHS.find((w) => w >= width) ?? 900;
    return url.replace(BUNDLED_POSTER, `/posters/w${best}/${bundled[2]}`);
  }

  try {
    const u = new URL(url);
    const isUnsplash = u.hostname === "images.unsplash.com";
    const isPexels = u.hostname === "images.pexels.com";
    if (!isUnsplash && !isPexels) return url;

    // Preserve the 3:4 poster aspect ratio the app uses everywhere.
    const height = Math.round((width * 4) / 3);
    u.searchParams.set("w", String(width));
    u.searchParams.set("h", String(height));
    if (isUnsplash) {
      if (!u.searchParams.has("fit")) u.searchParams.set("fit", "crop");
    } else {
      u.searchParams.set("fit", "crop");
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * A ~1 KB rendition of a stock-photo poster, shown blurred while the full
 * card image downloads so a loading card already shows the photo's colors.
 * Null for other hosts (bundled posters load from the app itself, and
 * uploads have no smaller rendition — the "tiny" file would be the full one).
 */
export function tinyPosterUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    if (host !== "images.unsplash.com" && host !== "images.pexels.com") return null;
  } catch {
    return null;
  }
  return sizedPosterUrl(url, 32);
}
