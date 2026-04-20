import { Language } from "@/i18n/translations";
import { supabase } from "@/integrations/supabase/client";

/**
 * Static translations for country names across the 6 supported languages.
 * Source canonical name is the English form used in the database.
 */
const COUNTRY_NAME_TRANSLATIONS: Record<string, Partial<Record<Language, string>>> = {
  "Afghanistan": { fr: "Afghanistan", es: "Afganistán", it: "Afghanistan", pt: "Afeganistão", nl: "Afghanistan" },
  "Albania": { fr: "Albanie", es: "Albania", it: "Albania", pt: "Albânia", nl: "Albanië" },
  "Algeria": { fr: "Algérie", es: "Argelia", it: "Algeria", pt: "Argélia", nl: "Algerije" },
  "Andorra": { fr: "Andorre", es: "Andorra", it: "Andorra", pt: "Andorra", nl: "Andorra" },
  "Angola": { fr: "Angola", es: "Angola", it: "Angola", pt: "Angola", nl: "Angola" },
  "Argentina": { fr: "Argentine", es: "Argentina", it: "Argentina", pt: "Argentina", nl: "Argentinië" },
  "Armenia": { fr: "Arménie", es: "Armenia", it: "Armenia", pt: "Arménia", nl: "Armenië" },
  "Australia": { fr: "Australie", es: "Australia", it: "Australia", pt: "Austrália", nl: "Australië" },
  "Austria": { fr: "Autriche", es: "Austria", it: "Austria", pt: "Áustria", nl: "Oostenrijk" },
  "Azerbaijan": { fr: "Azerbaïdjan", es: "Azerbaiyán", it: "Azerbaigian", pt: "Azerbaijão", nl: "Azerbeidzjan" },
  "Bahamas": { fr: "Bahamas", es: "Bahamas", it: "Bahamas", pt: "Bahamas", nl: "Bahama's" },
  "Bahrain": { fr: "Bahreïn", es: "Baréin", it: "Bahrein", pt: "Bahrein", nl: "Bahrein" },
  "Bangladesh": { fr: "Bangladesh", es: "Bangladés", it: "Bangladesh", pt: "Bangladesh", nl: "Bangladesh" },
  "Barbados": { fr: "Barbade", es: "Barbados", it: "Barbados", pt: "Barbados", nl: "Barbados" },
  "Belarus": { fr: "Biélorussie", es: "Bielorrusia", it: "Bielorussia", pt: "Bielorrússia", nl: "Wit-Rusland" },
  "Belgium": { fr: "Belgique", es: "Bélgica", it: "Belgio", pt: "Bélgica", nl: "België" },
  "Belize": { fr: "Belize", es: "Belice", it: "Belize", pt: "Belize", nl: "Belize" },
  "Benin": { fr: "Bénin", es: "Benín", it: "Benin", pt: "Benim", nl: "Benin" },
  "Bhutan": { fr: "Bhoutan", es: "Bután", it: "Bhutan", pt: "Butão", nl: "Bhutan" },
  "Bolivia": { fr: "Bolivie", es: "Bolivia", it: "Bolivia", pt: "Bolívia", nl: "Bolivia" },
  "Bosnia and Herzegovina": { fr: "Bosnie-Herzégovine", es: "Bosnia y Herzegovina", it: "Bosnia ed Erzegovina", pt: "Bósnia e Herzegovina", nl: "Bosnië en Herzegovina" },
  "Botswana": { fr: "Botswana", es: "Botsuana", it: "Botswana", pt: "Botsuana", nl: "Botswana" },
  "Brazil": { fr: "Brésil", es: "Brasil", it: "Brasile", pt: "Brasil", nl: "Brazilië" },
  "Brunei": { fr: "Brunei", es: "Brunéi", it: "Brunei", pt: "Brunei", nl: "Brunei" },
  "Bulgaria": { fr: "Bulgarie", es: "Bulgaria", it: "Bulgaria", pt: "Bulgária", nl: "Bulgarije" },
  "Burkina Faso": { fr: "Burkina Faso", es: "Burkina Faso", it: "Burkina Faso", pt: "Burquina Faso", nl: "Burkina Faso" },
  "Burundi": { fr: "Burundi", es: "Burundi", it: "Burundi", pt: "Burundi", nl: "Burundi" },
  "Cambodia": { fr: "Cambodge", es: "Camboya", it: "Cambogia", pt: "Camboja", nl: "Cambodja" },
  "Cameroon": { fr: "Cameroun", es: "Camerún", it: "Camerun", pt: "Camarões", nl: "Kameroen" },
  "Canada": { fr: "Canada", es: "Canadá", it: "Canada", pt: "Canadá", nl: "Canada" },
  "Chad": { fr: "Tchad", es: "Chad", it: "Ciad", pt: "Chade", nl: "Tsjaad" },
  "Chile": { fr: "Chili", es: "Chile", it: "Cile", pt: "Chile", nl: "Chili" },
  "China": { fr: "Chine", es: "China", it: "Cina", pt: "China", nl: "China" },
  "Colombia": { fr: "Colombie", es: "Colombia", it: "Colombia", pt: "Colômbia", nl: "Colombia" },
  "Congo": { fr: "Congo", es: "Congo", it: "Congo", pt: "Congo", nl: "Congo" },
  "Costa Rica": { fr: "Costa Rica", es: "Costa Rica", it: "Costa Rica", pt: "Costa Rica", nl: "Costa Rica" },
  "Croatia": { fr: "Croatie", es: "Croacia", it: "Croazia", pt: "Croácia", nl: "Kroatië" },
  "Cuba": { fr: "Cuba", es: "Cuba", it: "Cuba", pt: "Cuba", nl: "Cuba" },
  "Cyprus": { fr: "Chypre", es: "Chipre", it: "Cipro", pt: "Chipre", nl: "Cyprus" },
  "Czech Republic": { fr: "République tchèque", es: "República Checa", it: "Repubblica Ceca", pt: "República Checa", nl: "Tsjechië" },
  "Czechia": { fr: "Tchéquie", es: "Chequia", it: "Cechia", pt: "Chéquia", nl: "Tsjechië" },
  "Denmark": { fr: "Danemark", es: "Dinamarca", it: "Danimarca", pt: "Dinamarca", nl: "Denemarken" },
  "Dominican Republic": { fr: "République dominicaine", es: "República Dominicana", it: "Repubblica Dominicana", pt: "República Dominicana", nl: "Dominicaanse Republiek" },
  "Ecuador": { fr: "Équateur", es: "Ecuador", it: "Ecuador", pt: "Equador", nl: "Ecuador" },
  "Egypt": { fr: "Égypte", es: "Egipto", it: "Egitto", pt: "Egito", nl: "Egypte" },
  "El Salvador": { fr: "Salvador", es: "El Salvador", it: "El Salvador", pt: "El Salvador", nl: "El Salvador" },
  "Estonia": { fr: "Estonie", es: "Estonia", it: "Estonia", pt: "Estónia", nl: "Estland" },
  "Ethiopia": { fr: "Éthiopie", es: "Etiopía", it: "Etiopia", pt: "Etiópia", nl: "Ethiopië" },
  "Fiji": { fr: "Fidji", es: "Fiyi", it: "Figi", pt: "Fiji", nl: "Fiji" },
  "Finland": { fr: "Finlande", es: "Finlandia", it: "Finlandia", pt: "Finlândia", nl: "Finland" },
  "France": { fr: "France", es: "Francia", it: "Francia", pt: "França", nl: "Frankrijk" },
  "Gabon": { fr: "Gabon", es: "Gabón", it: "Gabon", pt: "Gabão", nl: "Gabon" },
  "Georgia": { fr: "Géorgie", es: "Georgia", it: "Georgia", pt: "Geórgia", nl: "Georgië" },
  "Germany": { fr: "Allemagne", es: "Alemania", it: "Germania", pt: "Alemanha", nl: "Duitsland" },
  "Ghana": { fr: "Ghana", es: "Ghana", it: "Ghana", pt: "Gana", nl: "Ghana" },
  "Greece": { fr: "Grèce", es: "Grecia", it: "Grecia", pt: "Grécia", nl: "Griekenland" },
  "Guatemala": { fr: "Guatemala", es: "Guatemala", it: "Guatemala", pt: "Guatemala", nl: "Guatemala" },
  "Guinea": { fr: "Guinée", es: "Guinea", it: "Guinea", pt: "Guiné", nl: "Guinee" },
  "Haiti": { fr: "Haïti", es: "Haití", it: "Haiti", pt: "Haiti", nl: "Haïti" },
  "Honduras": { fr: "Honduras", es: "Honduras", it: "Honduras", pt: "Honduras", nl: "Honduras" },
  "Hungary": { fr: "Hongrie", es: "Hungría", it: "Ungheria", pt: "Hungria", nl: "Hongarije" },
  "Iceland": { fr: "Islande", es: "Islandia", it: "Islanda", pt: "Islândia", nl: "IJsland" },
  "India": { fr: "Inde", es: "India", it: "India", pt: "Índia", nl: "India" },
  "Indonesia": { fr: "Indonésie", es: "Indonesia", it: "Indonesia", pt: "Indonésia", nl: "Indonesië" },
  "Iran": { fr: "Iran", es: "Irán", it: "Iran", pt: "Irão", nl: "Iran" },
  "Iraq": { fr: "Irak", es: "Irak", it: "Iraq", pt: "Iraque", nl: "Irak" },
  "Ireland": { fr: "Irlande", es: "Irlanda", it: "Irlanda", pt: "Irlanda", nl: "Ierland" },
  "Israel": { fr: "Israël", es: "Israel", it: "Israele", pt: "Israel", nl: "Israël" },
  "Italy": { fr: "Italie", es: "Italia", it: "Italia", pt: "Itália", nl: "Italië" },
  "Jamaica": { fr: "Jamaïque", es: "Jamaica", it: "Giamaica", pt: "Jamaica", nl: "Jamaica" },
  "Japan": { fr: "Japon", es: "Japón", it: "Giappone", pt: "Japão", nl: "Japan" },
  "Jordan": { fr: "Jordanie", es: "Jordania", it: "Giordania", pt: "Jordânia", nl: "Jordanië" },
  "Kazakhstan": { fr: "Kazakhstan", es: "Kazajistán", it: "Kazakistan", pt: "Cazaquistão", nl: "Kazachstan" },
  "Kenya": { fr: "Kenya", es: "Kenia", it: "Kenya", pt: "Quénia", nl: "Kenia" },
  "Kuwait": { fr: "Koweït", es: "Kuwait", it: "Kuwait", pt: "Kuwait", nl: "Koeweit" },
  "Laos": { fr: "Laos", es: "Laos", it: "Laos", pt: "Laos", nl: "Laos" },
  "Latvia": { fr: "Lettonie", es: "Letonia", it: "Lettonia", pt: "Letónia", nl: "Letland" },
  "Lebanon": { fr: "Liban", es: "Líbano", it: "Libano", pt: "Líbano", nl: "Libanon" },
  "Libya": { fr: "Libye", es: "Libia", it: "Libia", pt: "Líbia", nl: "Libië" },
  "Lithuania": { fr: "Lituanie", es: "Lituania", it: "Lituania", pt: "Lituânia", nl: "Litouwen" },
  "Luxembourg": { fr: "Luxembourg", es: "Luxemburgo", it: "Lussemburgo", pt: "Luxemburgo", nl: "Luxemburg" },
  "Madagascar": { fr: "Madagascar", es: "Madagascar", it: "Madagascar", pt: "Madagáscar", nl: "Madagaskar" },
  "Malaysia": { fr: "Malaisie", es: "Malasia", it: "Malesia", pt: "Malásia", nl: "Maleisië" },
  "Maldives": { fr: "Maldives", es: "Maldivas", it: "Maldive", pt: "Maldivas", nl: "Maldiven" },
  "Mali": { fr: "Mali", es: "Malí", it: "Mali", pt: "Mali", nl: "Mali" },
  "Malta": { fr: "Malte", es: "Malta", it: "Malta", pt: "Malta", nl: "Malta" },
  "Mexico": { fr: "Mexique", es: "México", it: "Messico", pt: "México", nl: "Mexico" },
  "Moldova": { fr: "Moldavie", es: "Moldavia", it: "Moldavia", pt: "Moldávia", nl: "Moldavië" },
  "Monaco": { fr: "Monaco", es: "Mónaco", it: "Monaco", pt: "Mónaco", nl: "Monaco" },
  "Mongolia": { fr: "Mongolie", es: "Mongolia", it: "Mongolia", pt: "Mongólia", nl: "Mongolië" },
  "Montenegro": { fr: "Monténégro", es: "Montenegro", it: "Montenegro", pt: "Montenegro", nl: "Montenegro" },
  "Morocco": { fr: "Maroc", es: "Marruecos", it: "Marocco", pt: "Marrocos", nl: "Marokko" },
  "Mozambique": { fr: "Mozambique", es: "Mozambique", it: "Mozambico", pt: "Moçambique", nl: "Mozambique" },
  "Myanmar": { fr: "Birmanie", es: "Birmania", it: "Birmania", pt: "Mianmar", nl: "Myanmar" },
  "Namibia": { fr: "Namibie", es: "Namibia", it: "Namibia", pt: "Namíbia", nl: "Namibië" },
  "Nepal": { fr: "Népal", es: "Nepal", it: "Nepal", pt: "Nepal", nl: "Nepal" },
  "Netherlands": { fr: "Pays-Bas", es: "Países Bajos", it: "Paesi Bassi", pt: "Países Baixos", nl: "Nederland" },
  "New Zealand": { fr: "Nouvelle-Zélande", es: "Nueva Zelanda", it: "Nuova Zelanda", pt: "Nova Zelândia", nl: "Nieuw-Zeeland" },
  "Nicaragua": { fr: "Nicaragua", es: "Nicaragua", it: "Nicaragua", pt: "Nicarágua", nl: "Nicaragua" },
  "Niger": { fr: "Niger", es: "Níger", it: "Niger", pt: "Níger", nl: "Niger" },
  "Nigeria": { fr: "Nigeria", es: "Nigeria", it: "Nigeria", pt: "Nigéria", nl: "Nigeria" },
  "North Macedonia": { fr: "Macédoine du Nord", es: "Macedonia del Norte", it: "Macedonia del Nord", pt: "Macedónia do Norte", nl: "Noord-Macedonië" },
  "North Korea": { fr: "Corée du Nord", es: "Corea del Norte", it: "Corea del Nord", pt: "Coreia do Norte", nl: "Noord-Korea" },
  "Norway": { fr: "Norvège", es: "Noruega", it: "Norvegia", pt: "Noruega", nl: "Noorwegen" },
  "Oman": { fr: "Oman", es: "Omán", it: "Oman", pt: "Omã", nl: "Oman" },
  "Pakistan": { fr: "Pakistan", es: "Pakistán", it: "Pakistan", pt: "Paquistão", nl: "Pakistan" },
  "Panama": { fr: "Panama", es: "Panamá", it: "Panama", pt: "Panamá", nl: "Panama" },
  "Paraguay": { fr: "Paraguay", es: "Paraguay", it: "Paraguay", pt: "Paraguai", nl: "Paraguay" },
  "Peru": { fr: "Pérou", es: "Perú", it: "Perù", pt: "Peru", nl: "Peru" },
  "Philippines": { fr: "Philippines", es: "Filipinas", it: "Filippine", pt: "Filipinas", nl: "Filipijnen" },
  "Poland": { fr: "Pologne", es: "Polonia", it: "Polonia", pt: "Polónia", nl: "Polen" },
  "Portugal": { fr: "Portugal", es: "Portugal", it: "Portogallo", pt: "Portugal", nl: "Portugal" },
  "Qatar": { fr: "Qatar", es: "Catar", it: "Qatar", pt: "Catar", nl: "Qatar" },
  "Romania": { fr: "Roumanie", es: "Rumania", it: "Romania", pt: "Roménia", nl: "Roemenië" },
  "Russia": { fr: "Russie", es: "Rusia", it: "Russia", pt: "Rússia", nl: "Rusland" },
  "Rwanda": { fr: "Rwanda", es: "Ruanda", it: "Ruanda", pt: "Ruanda", nl: "Rwanda" },
  "Saudi Arabia": { fr: "Arabie saoudite", es: "Arabia Saudita", it: "Arabia Saudita", pt: "Arábia Saudita", nl: "Saoedi-Arabië" },
  "Senegal": { fr: "Sénégal", es: "Senegal", it: "Senegal", pt: "Senegal", nl: "Senegal" },
  "Serbia": { fr: "Serbie", es: "Serbia", it: "Serbia", pt: "Sérvia", nl: "Servië" },
  "Singapore": { fr: "Singapour", es: "Singapur", it: "Singapore", pt: "Singapura", nl: "Singapore" },
  "Slovakia": { fr: "Slovaquie", es: "Eslovaquia", it: "Slovacchia", pt: "Eslováquia", nl: "Slowakije" },
  "Slovenia": { fr: "Slovénie", es: "Eslovenia", it: "Slovenia", pt: "Eslovénia", nl: "Slovenië" },
  "Somalia": { fr: "Somalie", es: "Somalia", it: "Somalia", pt: "Somália", nl: "Somalië" },
  "South Africa": { fr: "Afrique du Sud", es: "Sudáfrica", it: "Sudafrica", pt: "África do Sul", nl: "Zuid-Afrika" },
  "South Korea": { fr: "Corée du Sud", es: "Corea del Sur", it: "Corea del Sud", pt: "Coreia do Sul", nl: "Zuid-Korea" },
  "Spain": { fr: "Espagne", es: "España", it: "Spagna", pt: "Espanha", nl: "Spanje" },
  "Sri Lanka": { fr: "Sri Lanka", es: "Sri Lanka", it: "Sri Lanka", pt: "Sri Lanka", nl: "Sri Lanka" },
  "Sudan": { fr: "Soudan", es: "Sudán", it: "Sudan", pt: "Sudão", nl: "Soedan" },
  "Sweden": { fr: "Suède", es: "Suecia", it: "Svezia", pt: "Suécia", nl: "Zweden" },
  "Switzerland": { fr: "Suisse", es: "Suiza", it: "Svizzera", pt: "Suíça", nl: "Zwitserland" },
  "Syria": { fr: "Syrie", es: "Siria", it: "Siria", pt: "Síria", nl: "Syrië" },
  "Taiwan": { fr: "Taïwan", es: "Taiwán", it: "Taiwan", pt: "Taiwan", nl: "Taiwan" },
  "Tanzania": { fr: "Tanzanie", es: "Tanzania", it: "Tanzania", pt: "Tanzânia", nl: "Tanzania" },
  "Thailand": { fr: "Thaïlande", es: "Tailandia", it: "Thailandia", pt: "Tailândia", nl: "Thailand" },
  "Togo": { fr: "Togo", es: "Togo", it: "Togo", pt: "Togo", nl: "Togo" },
  "Tunisia": { fr: "Tunisie", es: "Túnez", it: "Tunisia", pt: "Tunísia", nl: "Tunesië" },
  "Turkey": { fr: "Turquie", es: "Turquía", it: "Turchia", pt: "Turquia", nl: "Turkije" },
  "Uganda": { fr: "Ouganda", es: "Uganda", it: "Uganda", pt: "Uganda", nl: "Oeganda" },
  "Ukraine": { fr: "Ukraine", es: "Ucrania", it: "Ucraina", pt: "Ucrânia", nl: "Oekraïne" },
  "United Arab Emirates": { fr: "Émirats arabes unis", es: "Emiratos Árabes Unidos", it: "Emirati Arabi Uniti", pt: "Emirados Árabes Unidos", nl: "Verenigde Arabische Emiraten" },
  "United Kingdom": { fr: "Royaume-Uni", es: "Reino Unido", it: "Regno Unito", pt: "Reino Unido", nl: "Verenigd Koninkrijk" },
  "United States": { fr: "États-Unis", es: "Estados Unidos", it: "Stati Uniti", pt: "Estados Unidos", nl: "Verenigde Staten" },
  "Uruguay": { fr: "Uruguay", es: "Uruguay", it: "Uruguay", pt: "Uruguai", nl: "Uruguay" },
  "Uzbekistan": { fr: "Ouzbékistan", es: "Uzbekistán", it: "Uzbekistan", pt: "Uzbequistão", nl: "Oezbekistan" },
  "Venezuela": { fr: "Venezuela", es: "Venezuela", it: "Venezuela", pt: "Venezuela", nl: "Venezuela" },
  "Vietnam": { fr: "Viêt Nam", es: "Vietnam", it: "Vietnam", pt: "Vietname", nl: "Vietnam" },
  "Yemen": { fr: "Yémen", es: "Yemen", it: "Yemen", pt: "Iémen", nl: "Jemen" },
  "Zambia": { fr: "Zambie", es: "Zambia", it: "Zambia", pt: "Zâmbia", nl: "Zambia" },
  "Zimbabwe": { fr: "Zimbabwe", es: "Zimbabue", it: "Zimbabwe", pt: "Zimbabué", nl: "Zimbabwe" },
  // Common aliases
  "USA": { fr: "États-Unis", es: "Estados Unidos", it: "Stati Uniti", pt: "Estados Unidos", nl: "Verenigde Staten" },
  "UK": { fr: "Royaume-Uni", es: "Reino Unido", it: "Regno Unito", pt: "Reino Unido", nl: "Verenigd Koninkrijk" },
  "UAE": { fr: "Émirats arabes unis", es: "Emiratos Árabes Unidos", it: "Emirati Arabi Uniti", pt: "Emirados Árabes Unidos", nl: "Verenigde Arabische Emiraten" },
};

/** Static translations for the most common cities. */
const CITY_NAME_TRANSLATIONS: Record<string, Partial<Record<Language, string>>> = {
  "Paris": { es: "París", pt: "Paris", it: "Parigi", nl: "Parijs" },
  "London": { fr: "Londres", es: "Londres", it: "Londra", pt: "Londres", nl: "Londen" },
  "Rome": { fr: "Rome", es: "Roma", it: "Roma", pt: "Roma", nl: "Rome" },
  "Venice": { fr: "Venise", es: "Venecia", it: "Venezia", pt: "Veneza", nl: "Venetië" },
  "Florence": { fr: "Florence", es: "Florencia", it: "Firenze", pt: "Florença", nl: "Florence" },
  "Milan": { fr: "Milan", es: "Milán", it: "Milano", pt: "Milão", nl: "Milaan" },
  "Naples": { fr: "Naples", es: "Nápoles", it: "Napoli", pt: "Nápoles", nl: "Napels" },
  "Athens": { fr: "Athènes", es: "Atenas", it: "Atene", pt: "Atenas", nl: "Athene" },
  "Madrid": { fr: "Madrid", es: "Madrid", it: "Madrid", pt: "Madrid", nl: "Madrid" },
  "Barcelona": { fr: "Barcelone", es: "Barcelona", it: "Barcellona", pt: "Barcelona", nl: "Barcelona" },
  "Seville": { fr: "Séville", es: "Sevilla", it: "Siviglia", pt: "Sevilha", nl: "Sevilla" },
  "Lisbon": { fr: "Lisbonne", es: "Lisboa", it: "Lisbona", pt: "Lisboa", nl: "Lissabon" },
  "Berlin": { fr: "Berlin", es: "Berlín", it: "Berlino", pt: "Berlim", nl: "Berlijn" },
  "Munich": { fr: "Munich", es: "Múnich", it: "Monaco di Baviera", pt: "Munique", nl: "München" },
  "Vienna": { fr: "Vienne", es: "Viena", it: "Vienna", pt: "Viena", nl: "Wenen" },
  "Brussels": { fr: "Bruxelles", es: "Bruselas", it: "Bruxelles", pt: "Bruxelas", nl: "Brussel" },
  "Amsterdam": { fr: "Amsterdam", es: "Ámsterdam", it: "Amsterdam", pt: "Amesterdão", nl: "Amsterdam" },
  "Copenhagen": { fr: "Copenhague", es: "Copenhague", it: "Copenaghen", pt: "Copenhaga", nl: "Kopenhagen" },
  "Stockholm": { fr: "Stockholm", es: "Estocolmo", it: "Stoccolma", pt: "Estocolmo", nl: "Stockholm" },
  "Oslo": { fr: "Oslo", es: "Oslo", it: "Oslo", pt: "Oslo", nl: "Oslo" },
  "Helsinki": { fr: "Helsinki", es: "Helsinki", it: "Helsinki", pt: "Helsínquia", nl: "Helsinki" },
  "Warsaw": { fr: "Varsovie", es: "Varsovia", it: "Varsavia", pt: "Varsóvia", nl: "Warschau" },
  "Prague": { fr: "Prague", es: "Praga", it: "Praga", pt: "Praga", nl: "Praag" },
  "Budapest": { fr: "Budapest", es: "Budapest", it: "Budapest", pt: "Budapeste", nl: "Boedapest" },
  "Bucharest": { fr: "Bucarest", es: "Bucarest", it: "Bucarest", pt: "Bucareste", nl: "Boekarest" },
  "Moscow": { fr: "Moscou", es: "Moscú", it: "Mosca", pt: "Moscovo", nl: "Moskou" },
  "Saint Petersburg": { fr: "Saint-Pétersbourg", es: "San Petersburgo", it: "San Pietroburgo", pt: "São Petersburgo", nl: "Sint-Petersburg" },
  "Istanbul": { fr: "Istanbul", es: "Estambul", it: "Istanbul", pt: "Istambul", nl: "Istanboel" },
  "Cairo": { fr: "Le Caire", es: "El Cairo", it: "Il Cairo", pt: "Cairo", nl: "Caïro" },
  "Marrakech": { fr: "Marrakech", es: "Marrakech", it: "Marrakech", pt: "Marraquexe", nl: "Marrakesh" },
  "Casablanca": { fr: "Casablanca", es: "Casablanca", it: "Casablanca", pt: "Casablanca", nl: "Casablanca" },
  "Cape Town": { fr: "Le Cap", es: "Ciudad del Cabo", it: "Città del Capo", pt: "Cidade do Cabo", nl: "Kaapstad" },
  "Tokyo": { fr: "Tokyo", es: "Tokio", it: "Tokyo", pt: "Tóquio", nl: "Tokio" },
  "Kyoto": { fr: "Kyoto", es: "Kioto", it: "Kyoto", pt: "Quioto", nl: "Kioto" },
  "Osaka": { fr: "Osaka", es: "Osaka", it: "Osaka", pt: "Osaka", nl: "Osaka" },
  "Beijing": { fr: "Pékin", es: "Pekín", it: "Pechino", pt: "Pequim", nl: "Peking" },
  "Shanghai": { fr: "Shanghai", es: "Shanghái", it: "Shanghai", pt: "Xangai", nl: "Shanghai" },
  "Hong Kong": { fr: "Hong Kong", es: "Hong Kong", it: "Hong Kong", pt: "Hong Kong", nl: "Hongkong" },
  "Singapore": { fr: "Singapour", es: "Singapur", it: "Singapore", pt: "Singapura", nl: "Singapore" },
  "Bangkok": { fr: "Bangkok", es: "Bangkok", it: "Bangkok", pt: "Banguecoque", nl: "Bangkok" },
  "Seoul": { fr: "Séoul", es: "Seúl", it: "Seul", pt: "Seul", nl: "Seoel" },
  "New Delhi": { fr: "New Delhi", es: "Nueva Delhi", it: "Nuova Delhi", pt: "Nova Deli", nl: "New Delhi" },
  "Mumbai": { fr: "Mumbai", es: "Bombay", it: "Mumbai", pt: "Bombaim", nl: "Mumbai" },
  "Dubai": { fr: "Dubaï", es: "Dubái", it: "Dubai", pt: "Dubai", nl: "Dubai" },
  "Jerusalem": { fr: "Jérusalem", es: "Jerusalén", it: "Gerusalemme", pt: "Jerusalém", nl: "Jeruzalem" },
  "New York": { fr: "New York", es: "Nueva York", it: "New York", pt: "Nova Iorque", nl: "New York" },
  "Los Angeles": { fr: "Los Angeles", es: "Los Ángeles", it: "Los Angeles", pt: "Los Angeles", nl: "Los Angeles" },
  "San Francisco": { fr: "San Francisco", es: "San Francisco", it: "San Francisco", pt: "São Francisco", nl: "San Francisco" },
  "Mexico City": { fr: "Mexico", es: "Ciudad de México", it: "Città del Messico", pt: "Cidade do México", nl: "Mexico-Stad" },
  "Rio de Janeiro": { fr: "Rio de Janeiro", es: "Río de Janeiro", it: "Rio de Janeiro", pt: "Rio de Janeiro", nl: "Rio de Janeiro" },
  "Buenos Aires": { fr: "Buenos Aires", es: "Buenos Aires", it: "Buenos Aires", pt: "Buenos Aires", nl: "Buenos Aires" },
};

/**
 * In-memory cache for AI-translated names not in the static map.
 * Keyed by `${lang}::${name}`.
 */
const aiCache = new Map<string, string>();

const SS_KEY = "stampaway_translated_names_v1";
function loadSession(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveSession(map: Record<string, string>) {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(map)); } catch {}
}

// Hydrate aiCache once from session
let hydrated = false;
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  const m = loadSession();
  for (const k in m) aiCache.set(k, m[k]);
}

/** Synchronous lookup. Returns localized name or original. */
export function getStaticPlaceName(name: string, language: Language, isCountry: boolean): string {
  if (!name || language === "en") return name;
  const map = isCountry ? COUNTRY_NAME_TRANSLATIONS : CITY_NAME_TRANSLATIONS;
  return map[name]?.[language] ?? name;
}

/** Combined lookup including any AI-translated names already cached. */
export function getCachedPlaceName(name: string, language: Language, isCountry: boolean): string {
  if (!name || language === "en") return name;
  const stat = getStaticPlaceName(name, language, isCountry);
  if (stat !== name) return stat;
  hydrate();
  return aiCache.get(`${language}::${name}`) ?? name;
}

const inflight = new Map<string, Promise<string[]>>();

/**
 * Translate any uncached names via the edge function. Caches results.
 * Returns the final localized list in the same order.
 */
export async function ensurePlaceNamesTranslated(
  names: string[],
  language: Language,
  isCountry: boolean,
): Promise<string[]> {
  if (language === "en" || names.length === 0) return names;
  hydrate();

  // Determine which need AI translation
  const needs: string[] = [];
  const map = isCountry ? COUNTRY_NAME_TRANSLATIONS : CITY_NAME_TRANSLATIONS;
  names.forEach((n) => {
    if (!n) return;
    if (map[n]?.[language]) return;
    const key = `${language}::${n}`;
    if (aiCache.has(key)) return;
    if (!needs.includes(n)) needs.push(n);
  });

  if (needs.length > 0) {
    const flightKey = `${language}::${isCountry ? "C" : "c"}::${needs.join("|")}`;
    let p = inflight.get(flightKey);
    if (!p) {
      p = (async () => {
        const { data, error } = await supabase.functions.invoke("translate-text", {
          body: { texts: needs, language, kind: "name" },
        });
        if (error || !data?.translations) return needs;
        return data.translations as string[];
      })();
      inflight.set(flightKey, p);
      p.finally(() => inflight.delete(flightKey));
    }
    const translated = await p;
    const sessMap = loadSession();
    needs.forEach((src, idx) => {
      const t = translated[idx] || src;
      aiCache.set(`${language}::${src}`, t);
      sessMap[`${language}::${src}`] = t;
    });
    saveSession(sessMap);
  }

  return names.map((n) => getCachedPlaceName(n, language, isCountry));
}
