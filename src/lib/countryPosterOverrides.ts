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

const countryPosterOverrides: Record<string, string> = {
  Portugal: portugalPoster.url,
  Qatar: qatarPoster.url,
  Vanuatu: vanuatuPoster.url,
  Bhutan: bhutanPoster.url,
  Eritrea: eritreaPoster.url,
  Iraq: iraqPoster.url,
  Liberia: liberiaPoster.url,
  Uganda: ugandaPoster.url,
  Libya: libyaPoster.url,
  Mongolia: mongoliaPoster.url,
  Russia: russiaPoster.url,
  "Saint Lucia": saintLuciaPoster.url,
};

const cityPosterOverrides: Record<string, string> = {
  London: londonPoster.url,
  Athens: athensPoster.url,
  Marrakesh: marrakeshPoster.url,
  Budapest: budapestPoster.url,
  Ibiza: ibizaPoster.url,
  Lisbon: lisbonPoster.url,
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

