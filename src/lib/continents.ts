export const EUROPE_COUNTRIES = [
  "Albania","Andorra","Austria","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Cyprus","Czech Republic","Czechia","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Kosovo","Latvia","Liechtenstein","Lithuania","Luxembourg","Malta","Moldova","Monaco","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","San Marino","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Turkey","Ukraine","United Kingdom"
];

export const ASIA_COUNTRIES = [
  "Afghanistan","Armenia","Azerbaijan","Bahrain","Bangladesh","Bhutan","Brunei","Cambodia","China","East Timor","Georgia","India","Indonesia","Iran","Iraq","Israel","Japan","Jordan","Kazakhstan","Kuwait","Kyrgyzstan","Laos","Lebanon","Malaysia","Maldives","Mongolia","Myanmar","Nepal","North Korea","Oman","Pakistan","Palestine","Philippines","Qatar","Saudi Arabia","Singapore","South Korea","Sri Lanka","Syria","Taiwan","Tajikistan","Thailand","Turkmenistan","United Arab Emirates","Uzbekistan","Vietnam","Yemen"
];

export const NORTH_AMERICA_COUNTRIES = [
  "Antigua and Barbuda","Bahamas","Barbados","Belize","Canada","Costa Rica","Cuba","Dominica","Dominican Republic","El Salvador","Grenada","Guatemala","Haiti","Honduras","Jamaica","Mexico","Nicaragua","Panama","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Trinidad and Tobago","United States"
];

export const SOUTH_AMERICA_COUNTRIES = [
  "Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Guyana","Paraguay","Peru","Suriname","Uruguay","Venezuela"
];

export const AFRICA_COUNTRIES = [
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cabo Verde","Cameroon","Central African Republic","Chad","Comoros","Congo","DR Congo","Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia","Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Ivory Coast","Kenya","Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Rwanda","São Tomé and Príncipe","Senegal","Seychelles","Sierra Leone","Somalia","South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe"
];

export const OCEANIA_COUNTRIES = [
  "Australia","Fiji","Kiribati","Marshall Islands","Micronesia","Nauru","New Zealand","Palau","Papua New Guinea","Samoa","Solomon Islands","Tonga","Tuvalu","Vanuatu"
];

// Sub-regions used in Explore page category sections
export const SOUTHEAST_ASIA_COUNTRIES = [
  "Brunei","Cambodia","Indonesia","Laos","Malaysia","Myanmar","Philippines","Singapore","Thailand","Timor-Leste","East Timor","Vietnam"
];

export const CARIBBEAN_COUNTRIES = [
  "Antigua and Barbuda","Bahamas","Barbados","Cuba","Dominica","Dominican Republic","Grenada","Haiti","Jamaica","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Trinidad and Tobago"
];

export const EASTERN_EUROPE_COUNTRIES = [
  "Albania","Armenia","Azerbaijan","Belarus","Bosnia and Herzegovina","Bulgaria","Croatia","Czech Republic","Czechia","Estonia","Hungary","Kosovo","Latvia","Lithuania","Moldova","Montenegro","North Macedonia","Poland","Romania","Russia","Serbia","Slovakia","Slovenia","Ukraine"
];

export const MIDDLE_EAST_COUNTRIES = [
  "Cyprus","Lebanon","Syria","Iraq","Iran","Israel","Jordan","Saudi Arabia","Kuwait","Qatar","Bahrain","United Arab Emirates","Oman","Yemen","Turkey","Palestine"
];

// Map of named regions -> country list, used by ExploreListPage when ?region= is set.
export const NAMED_REGIONS: Record<string, string[]> = {
  "Southeast Asia": SOUTHEAST_ASIA_COUNTRIES,
  "Caribbean": CARIBBEAN_COUNTRIES,
  "Eastern Europe": EASTERN_EUROPE_COUNTRIES,
  "Middle East": MIDDLE_EAST_COUNTRIES,
};
