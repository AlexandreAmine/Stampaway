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

export function getCountryPosterOverride(countryName?: string | null) {
  if (!countryName) return null;
  return countryPosterOverrides[countryName] ?? null;
}
