/**
 * Local replacement for the ui-avatars.com fallback avatars: identical look
 * (solid #3B82F6 background, white centered initials, circle shape comes
 * from the callers' rounded-full CSS) but generated as an inline SVG data
 * URI — zero network requests, renders instantly, works offline.
 *
 * Matches ui-avatars' default initials rule: first letter of the first and
 * last words, uppercased.
 */
export function fallbackAvatarUrl(name?: string | null): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  const initials = (
    words.length === 0
      ? "?"
      : words.length === 1
        ? words[0][0]
        : words[0][0] + words[words.length - 1][0]
  ).toUpperCase();

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="#3B82F6"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" ` +
    `font-family="-apple-system, BlinkMacSystemFont, Inter, sans-serif" ` +
    `font-size="${initials.length > 1 ? 22 : 26}" fill="#fff">${initials}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
