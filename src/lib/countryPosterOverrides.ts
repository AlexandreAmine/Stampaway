import portugalPoster from "@/assets/countries/portugal.png.asset.json";
import qatarPoster from "@/assets/countries/qatar.png.asset.json";
import vanuatuPoster from "@/assets/countries/vanuatu.png.asset.json";
import bhutanPoster from "@/assets/countries/bhutan.png.asset.json";
import eritreaPoster from "@/assets/countries/eritrea.png.asset.json";
import iraqPoster from "@/assets/countries/iraq.png.asset.json";
import liberiaPoster from "@/assets/countries/liberia.png.asset.json";
import ugandaPoster from "@/assets/countries/uganda.png.asset.json";
import libyaPoster from "@/assets/countries/libya.png.asset.json";
import mongoliaPoster from "@/assets/countries/mongolia.png.asset.json";
import russiaPoster from "@/assets/countries/russia.png.asset.json";
import saintLuciaPoster from "@/assets/countries/saint-lucia.png.asset.json";
import londonPoster from "@/assets/cities/london.png.asset.json";
import athensPoster from "@/assets/cities/athens.png.asset.json";
import marrakeshPoster from "@/assets/cities/marrakesh.png.asset.json";
import budapestPoster from "@/assets/cities/budapest.png.asset.json";
import ibizaPoster from "@/assets/cities/ibiza.png.asset.json";
import lisbonPoster from "@/assets/cities/lisbon.png.asset.json";

// Lovable serves uploaded assets from a root-relative path (/__l5e/...).
// That works in a browser (resolves against the published origin) but
// inside the Capacitor iOS/Android WebView the root is capacitor://localhost,
// so the images 404. Force an absolute https URL for native builds.
const ASSET_ORIGIN = "https://stampaway.lovable.app";

function absolutize(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${ASSET_ORIGIN}${url}`;
  return url;
}

const countryPosterOverrides: Record<string, string> = {
  Portugal: absolutize(portugalPoster.url),
  Qatar: absolutize(qatarPoster.url),
  Vanuatu: absolutize(vanuatuPoster.url),
  Bhutan: absolutize(bhutanPoster.url),
  Eritrea: absolutize(eritreaPoster.url),
  Iraq: absolutize(iraqPoster.url),
  Liberia: absolutize(liberiaPoster.url),
  Uganda: absolutize(ugandaPoster.url),
  Libya: absolutize(libyaPoster.url),
  Mongolia: absolutize(mongoliaPoster.url),
  Russia: absolutize(russiaPoster.url),
  "Saint Lucia": absolutize(saintLuciaPoster.url),
};

const cityPosterOverrides: Record<string, string> = {
  London: absolutize(londonPoster.url),
  Athens: absolutize(athensPoster.url),
  Marrakesh: absolutize(marrakeshPoster.url),
  Budapest: absolutize(budapestPoster.url),
  Ibiza: absolutize(ibizaPoster.url),
  Lisbon: absolutize(lisbonPoster.url),
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

