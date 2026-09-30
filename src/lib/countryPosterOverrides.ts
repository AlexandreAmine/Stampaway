// Hand-picked posters for destinations whose stored photo was replaced.
//
// They ship with the app in public/posters, in three widths (200/450/900 px,
// JPEG). They used to load from Lovable's asset host as full-size PNGs —
// ~2.4 MB and 941×1672 each, behind a redirect — even for 120 px cards.
// sizedPosterUrl() (lib/imageSizing) picks the width each screen needs; the
// map below points at the largest one. Aspect ratio is unchanged, so the
// crop on screen is identical.

const poster = (slug: string) => `${import.meta.env.BASE_URL}posters/w900/${slug}.jpg`;

const countryPosterOverrides: Record<string, string> = {
  Portugal: poster("portugal"),
  Qatar: poster("qatar"),
  Vanuatu: poster("vanuatu"),
  Bhutan: poster("bhutan"),
  Eritrea: poster("eritrea"),
  Iraq: poster("iraq"),
  Liberia: poster("liberia"),
  Uganda: poster("uganda"),
  Libya: poster("libya"),
  Mongolia: poster("mongolia"),
  Russia: poster("russia"),
  "Saint Lucia": poster("saint-lucia"),
};

const cityPosterOverrides: Record<string, string> = {
  London: poster("london"),
  Athens: poster("athens"),
  Marrakesh: poster("marrakesh"),
  Budapest: poster("budapest"),
  Ibiza: poster("ibiza"),
  Lisbon: poster("lisbon"),
};

export function getDestinationPosterOverride(name?: string | null, type?: string | null) {
  if (!name) return null;
  if (type === "country") return countryPosterOverrides[name] ?? null;
  if (type === "city") return cityPosterOverrides[name] ?? null;
  return countryPosterOverrides[name] ?? cityPosterOverrides[name] ?? null;
}

export function getCountryPosterOverride(countryName?: string | null) {
  return getDestinationPosterOverride(countryName, "country");
}

export function getCityPosterOverride(cityName?: string | null) {
  return getDestinationPosterOverride(cityName, "city");
}
