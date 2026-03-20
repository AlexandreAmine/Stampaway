// Major city approximate coordinates [lat, lng]
const cityCoords: Record<string, [number, number]> = {
  "Tokyo": [35.6762, 139.6503], "Delhi": [28.7041, 77.1025], "Shanghai": [31.2304, 121.4737],
  "São Paulo": [-23.5505, -46.6333], "Mexico City": [19.4326, -99.1332], "Cairo": [30.0444, 31.2357],
  "Mumbai": [19.076, 72.8777], "Beijing": [39.9042, 116.4074], "Dhaka": [23.8103, 90.4125],
  "Osaka": [34.6937, 135.5023], "New York": [40.7128, -74.006], "Karachi": [24.8607, 67.0011],
  "Buenos Aires": [-34.6037, -58.3816], "Istanbul": [41.0082, 28.9784], "Chongqing": [29.4316, 106.9123],
  "Kolkata": [22.5726, 88.3639], "Lagos": [6.5244, 3.3792], "Kinshasa": [-4.4419, 15.2663],
  "Manila": [14.5995, 120.9842], "Tianjin": [39.3434, 117.3616], "Guangzhou": [23.1291, 113.2644],
  "Rio de Janeiro": [-22.9068, -43.1729], "Lahore": [31.5204, 74.3587], "Bangalore": [12.9716, 77.5946],
  "Moscow": [55.7558, 37.6173], "Shenzhen": [22.5431, 114.0579], "Chennai": [13.0827, 80.2707],
  "Bogotá": [4.711, -74.0721], "Paris": [48.8566, 2.3522], "Jakarta": [-6.2088, 106.8456],
  "Lima": [-12.0464, -77.0428], "Bangkok": [13.7563, 100.5018], "Hyderabad": [17.385, 78.4867],
  "Seoul": [37.5665, 126.978], "Nagoya": [35.1815, 136.9066], "London": [51.5074, -0.1278],
  "Chengdu": [30.5728, 104.0668], "Tehran": [35.6892, 51.389], "Ho Chi Minh City": [10.8231, 106.6297],
  "Luanda": [-8.839, 13.2894], "Wuhan": [30.5928, 114.3055], "Ahmedabad": [23.0225, 72.5714],
  "Hangzhou": [30.2741, 120.1551], "Kuala Lumpur": [3.139, 101.6869], "Riyadh": [24.7136, 46.6753],
  "Surat": [21.1702, 72.8311], "Santiago": [-33.4489, -70.6693], "Madrid": [40.4168, -3.7038],
  "Pune": [18.5204, 73.8567], "Dar es Salaam": [-6.7924, 39.2083], "Toronto": [43.6532, -79.3832],
  "Johannesburg": [-26.2041, 28.0473], "Barcelona": [41.3874, 2.1686], "Singapore": [1.3521, 103.8198],
  "Yangon": [16.8661, 96.1951], "Alexandria": [31.2001, 29.9187], "Guadalajara": [20.6597, -103.3496],
  "Ankara": [39.9334, 32.8597], "Melbourne": [-37.8136, 144.9631], "Nairobi": [-1.2921, 36.8219],
  "Kabul": [34.5553, 69.2075], "Sydney": [-33.8688, 151.2093], "Abidjan": [5.3484, -4.0305],
  "Rome": [41.9028, 12.4964], "Berlin": [52.52, 13.405], "Dubai": [25.2048, 55.2708],
  "Casablanca": [33.5731, -7.5898], "Jeddah": [21.4858, 39.1925], "Cape Town": [-33.9249, 18.4241],
  "Los Angeles": [34.0522, -118.2437], "Chicago": [41.8781, -87.6298], "Houston": [29.7604, -95.3698],
  "Miami": [25.7617, -80.1918], "San Francisco": [37.7749, -122.4194], "Seattle": [47.6062, -122.3321],
  "Amsterdam": [52.3676, 4.9041], "Vienna": [48.2082, 16.3738], "Prague": [50.0755, 14.4378],
  "Dublin": [53.3498, -6.2603], "Lisbon": [38.7223, -9.1393], "Warsaw": [52.2297, 21.0122],
  "Budapest": [47.4979, 19.0402], "Brussels": [50.8503, 4.3517], "Munich": [48.1351, 11.582],
  "Milan": [45.4642, 9.19], "Athens": [37.9838, 23.7275], "Stockholm": [59.3293, 18.0686],
  "Copenhagen": [55.6761, 12.5683], "Helsinki": [60.1699, 24.9384], "Oslo": [59.9139, 10.7522],
  "Zurich": [47.3769, 8.5417], "Geneva": [46.2044, 6.1432], "Edinburgh": [55.9533, -3.1883],
  "Marrakech": [31.6295, -7.9811], "Addis Ababa": [9.025, 38.7469], "Accra": [5.6037, -0.187],
  "Dakar": [14.7167, -17.4677], "Algiers": [36.7538, 3.0588], "Tunis": [36.8065, 10.1815],
  "Kampala": [0.3476, 32.5825], "Kigali": [-1.9403, 29.8739], "Maputo": [-25.9692, 32.5732],
  "Doha": [25.2854, 51.531], "Abu Dhabi": [24.4539, 54.3773], "Muscat": [23.588, 58.3829],
  "Kuwait City": [29.3759, 47.9774], "Amman": [31.9454, 35.9284], "Beirut": [33.8938, 35.5018],
  "Tel Aviv": [32.0853, 34.7818], "Baku": [40.4093, 49.8671], "Tbilisi": [41.7151, 44.8271],
  "Yerevan": [40.1792, 44.4991], "Almaty": [43.2551, 76.9126], "Tashkent": [41.2995, 69.2401],
  "Ulaanbaatar": [47.8864, 106.9057], "Hanoi": [21.0278, 105.8342], "Phnom Penh": [11.5564, 104.9282],
  "Vientiane": [17.9757, 102.6331], "Colombo": [6.9271, 79.8612], "Kathmandu": [27.7172, 85.324],
  "Hong Kong": [22.3193, 114.1694], "Taipei": [25.033, 121.5654], "Auckland": [-36.8485, 174.7633],
  "Wellington": [-41.2865, 174.7762], "Fiji": [-17.7134, 178.065], "Havana": [23.1136, -82.3666],
  "Santo Domingo": [18.4861, -69.9312], "San Juan": [18.4655, -66.1057], "Panama City": [8.9824, -79.5199],
  "San José": [9.9281, -84.0907], "Guatemala City": [14.6349, -90.5069], "Quito": [-0.1807, -78.4678],
  "Medellín": [6.2476, -75.5658], "Cartagena": [10.391, -75.5144], "Cusco": [-13.532, -71.9675],
  "Montevideo": [-34.9011, -56.1645], "Asunción": [-25.2637, -57.5759], "La Paz": [-16.4897, -68.1193],
  "Brasília": [-15.7975, -47.8919], "Vancouver": [49.2827, -123.1207], "Montreal": [45.5017, -73.5673],
  "Montréal": [45.5017, -73.5673],
};

// Country approximate center coordinates
const countryCoords: Record<string, [number, number]> = {
  "France": [46.2276, 2.2137], "Japan": [36.2048, 138.2529], "Spain": [40.4637, -3.7492],
  "United States": [37.0902, -95.7129], "Italy": [41.8719, 12.5674], "Turkey": [38.9637, 35.2433],
  "Mexico": [23.6345, -102.5528], "Thailand": [15.87, 100.9925], "Germany": [51.1657, 10.4515],
  "United Kingdom": [55.3781, -3.436], "Australia": [-25.2744, 133.7751], "Brazil": [-14.235, -51.9253],
  "Canada": [56.1304, -106.3468], "China": [35.8617, 104.1954], "India": [20.5937, 78.9629],
  "Russia": [61.524, 105.3188], "South Korea": [35.9078, 127.7669], "Indonesia": [-0.7893, 113.9213],
  "Argentina": [-38.4161, -63.6167], "South Africa": [-30.5595, 22.9375],
  "Egypt": [26.8206, 30.8025], "Morocco": [31.7917, -7.0926], "Greece": [39.0742, 21.8243],
  "Portugal": [39.3999, -8.2245], "Netherlands": [52.1326, 5.2913], "Sweden": [60.1282, 18.6435],
  "Norway": [60.472, 8.4689], "Denmark": [56.2639, 9.5018], "Finland": [61.9241, 25.7482],
  "Switzerland": [46.8182, 8.2275], "Austria": [47.5162, 14.5501], "Belgium": [50.5039, 4.4699],
  "Poland": [51.9194, 19.1451], "Czech Republic": [49.8175, 15.473], "Czechia": [49.8175, 15.473],
  "Ireland": [53.1424, -7.6921], "Colombia": [4.5709, -74.2973], "Peru": [-9.19, -75.0152],
  "Chile": [-35.6751, -71.543], "Nigeria": [9.082, 8.6753], "Kenya": [-0.0236, 37.9062],
  "Tanzania": [-6.369, 34.8888], "Ethiopia": [9.145, 40.4897], "Ghana": [7.9465, -1.0232],
  "Vietnam": [14.0583, 108.2772], "Philippines": [12.8797, 121.774], "Malaysia": [4.2105, 101.9758],
  "Singapore": [1.3521, 103.8198], "New Zealand": [-40.9006, 174.886], "Pakistan": [30.3753, 69.3451],
  "Bangladesh": [23.685, 90.3563], "Sri Lanka": [7.8731, 80.7718], "Nepal": [28.3949, 84.124],
  "UAE": [23.4241, 53.8478], "United Arab Emirates": [23.4241, 53.8478], "Saudi Arabia": [23.8859, 45.0792],
  "Israel": [31.0461, 34.8516], "Jordan": [30.5852, 36.2384], "Lebanon": [33.8547, 35.8623],
};

export function getCityCoordinates(cityName: string): [number, number] | null {
  return cityCoords[cityName] || null;
}

export function getCountryCoordinates(countryName: string): [number, number] | null {
  return countryCoords[countryName] || null;
}

export function getPlaceCoordinates(placeName: string, country: string): [number, number] | null {
  return getCityCoordinates(placeName) || getCountryCoordinates(country) || null;
}
