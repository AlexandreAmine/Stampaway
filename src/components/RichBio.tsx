import { Fragment } from "react";
import { getFlagEmoji } from "@/lib/countryFlags";

// Country names to detect in bio text
const countryNames = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia",
  "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina",
  "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia",
  "Cameroon", "Canada", "Chad", "Chile", "China", "Colombia", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Czechia", "Denmark", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Estonia", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Georgia", "Germany", "Ghana", "Greece", "Guatemala", "Guinea", "Haiti",
  "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait",
  "Laos", "Latvia", "Lebanon", "Libya", "Lithuania", "Luxembourg", "Madagascar", "Malaysia",
  "Maldives", "Mali", "Malta", "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro",
  "Morocco", "Mozambique", "Myanmar", "Namibia", "Nepal", "Netherlands", "New Zealand",
  "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway", "Oman", "Pakistan",
  "Panama", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
  "Russia", "Rwanda", "Saudi Arabia", "Senegal", "Serbia", "Singapore", "Slovakia",
  "Slovenia", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan",
  "Sweden", "Switzerland", "Syria", "Taiwan", "Tanzania", "Thailand", "Togo", "Tunisia",
  "Turkey", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
  "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
  "USA", "UK", "UAE",
];

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function buildCountryRegex() {
  const sorted = [...countryNames].sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(${sorted.join("|")})\\b`, "gi");
}

const COUNTRY_REGEX = buildCountryRegex();

interface RichBioProps {
  text: string;
}

export function RichBio({ text }: RichBioProps) {
  // First split by URLs
  const urlParts = text.split(URL_REGEX);

  return (
    <span className="text-sm text-muted-foreground">
      {urlParts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {part}
            </a>
          );
        }
        // For non-URL parts, check for country names
        const countryParts = part.split(COUNTRY_REGEX);
        return (
          <Fragment key={i}>
            {countryParts.map((cp, j) => {
              const flag = getFlagEmoji(cp);
              if (flag) {
                return (
                  <Fragment key={j}>
                    {cp}<span className="ml-0.5">{flag}</span>
                  </Fragment>
                );
              }
              return <Fragment key={j}>{cp}</Fragment>;
            })}
          </Fragment>
        );
      })}
    </span>
  );
}
