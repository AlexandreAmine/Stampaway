/**
 * Rewrite stock-photo CDN URLs (Unsplash / Pexels) to request a smaller
 * rendition for card-sized contexts. Same photo and crop, far fewer pixels
 * to download and decode — poster URLs are stored at 900×1200, while cards
 * render at ~130–180 CSS px.
 *
 * Any other host (user uploads, overrides, local assets) is returned as-is.
 */
export function sizedPosterUrl(
  url: string | null | undefined,
  width: number
): string | null {
  if (!url) return null;
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
