import portugalPoster from "@/assets/countries/portugal.png.asset.json";
import qatarPoster from "@/assets/countries/qatar.png.asset.json";
import vanuatuPoster from "@/assets/countries/vanuatu.png.asset.json";
import bhutanPoster from "@/assets/countries/bhutan.png.asset.json";
import eritreaPoster from "@/assets/countries/eritrea.png.asset.json";
import iraqPoster from "@/assets/countries/iraq.png.asset.json";

const countryPosterOverrides: Record<string, string> = {
  Portugal: portugalPoster.url,
  Qatar: qatarPoster.url,
  Vanuatu: vanuatuPoster.url,
  Bhutan: bhutanPoster.url,
  Eritrea: eritreaPoster.url,
  Iraq: iraqPoster.url,
};

export function getCountryPosterOverride(countryName?: string | null) {
  if (!countryName) return null;
  return countryPosterOverrides[countryName] ?? null;
}
