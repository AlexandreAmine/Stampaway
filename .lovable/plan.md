# Add a Mapbox Map to StampAway

Today the app uses `react-simple-maps` (the visited-countries map in `MapTab.tsx`) and `react-globe.gl` (the 3D globe on Home). Mapbox would give us a real interactive street/satellite map with smooth zoom, custom pins, and clustering — great for things like a "places I've visited" map or a city detail map.

Below are the steps. We can apply this to a brand new screen, or replace one of the existing maps — that is the first decision to make.

## 1. Decide where the Mapbox map goes

Pick one (we can confirm before building):
- **A. New "Map" view** alongside the current visited-countries map (e.g. a toggle: Countries / World map).
- **B. On a Place page** — show the city/country location with a styled Mapbox map.
- **C. Replace the 3D globe on Home** with a Mapbox globe projection showing friend activity pins.

Each uses the same setup; only the data source and pins differ.

## 2. Get a Mapbox access token

Mapbox requires an account + a public access token (`pk.…`).

1. User creates a free account at mapbox.com.
2. In Account → Tokens, copy the **Default public token** (or create a new one scoped to URL = our preview + published + custom domain).
3. Mapbox public tokens are safe to ship in the frontend (they are URL-restricted), so we store it as a regular value — but to keep it editable without redeploys we will store it as a Lovable Cloud secret and expose it through a tiny edge function, OR put it directly in code if the user prefers simplicity.

Recommendation: **store it as a secret** (`MAPBOX_PUBLIC_TOKEN`) and fetch it once on app load via an edge function. This way the token can be rotated without a code change.

## 3. Install the Mapbox SDK

Add two packages:
- `mapbox-gl` — the core map library.
- `@types/mapbox-gl` — TypeScript types.

We import the Mapbox CSS once in `src/index.css` (or in the map component) so controls and popups render correctly.

## 4. Create a reusable `<MapboxMap />` component

A new file `src/components/MapboxMap.tsx` that:
- Accepts props: `center`, `zoom`, `pins` (array of `{ lat, lng, label, onClick }`), `style` (streets / satellite / dark), and an optional `projection` (`mercator` or `globe`).
- Initializes a `mapboxgl.Map` in a `useRef` div on mount, cleans it up on unmount.
- Uses our dark theme by default (`mapbox://styles/mapbox/dark-v11`) to match StampAway's pure-black UI.
- Renders custom HTML markers (avatar + flag pill, matching the style used on the Home globe).
- Optional: enables clustering when there are many pins.

## 5. Wire it into the chosen screen

Depending on the choice in step 1:
- **A**: add a tab toggle in `MapTab.tsx` and mount `<MapboxMap pins={visitedCities} />`.
- **B**: drop `<MapboxMap center={[lng, lat]} zoom={10} />` into `PlacePage.tsx`.
- **C**: replace the `<Globe />` in `HomePage.tsx` with `<MapboxMap projection="globe" pins={activities} />` and reuse the existing `handlePinClick` / `GlobeActivityPopup` logic.

## 6. Handle theme, sizing, and mobile

- Force the map into our dark palette (style + custom marker colors using primary `#3B82F6`).
- Make the container full width with `max-w-lg` to match the rest of the app.
- Disable Mapbox's default attribution position on small screens (move to bottom-left, compact mode) so it doesn't overlap our bottom nav.
- Ensure pinch-zoom works alongside iOS gestures (Capacitor already handles this; just verify in preview).

## 7. Add i18n strings

Any new UI text (tab labels like "Street map", empty states, "Powered by Mapbox" if shown) goes into `src/i18n/translations.ts` for all 6 languages.

## 8. QA checklist

- Token loads, map renders on first visit (no flash of empty container).
- Pins are clickable and navigate to the right place.
- Works in light + dark, web + Capacitor iOS preview.
- No layout overflow with our `max-w-lg` mobile shell.
- Bundle impact: `mapbox-gl` is ~800 KB gzipped — we lazy-load the component with `React.lazy` so it only loads on the map screen.

## Technical notes

- Token delivery: small edge function `get-mapbox-token` returns `{ token: Deno.env.get("MAPBOX_PUBLIC_TOKEN") }`. Frontend caches it in a React context.
- Dependencies: `bun add mapbox-gl` + `bun add -d @types/mapbox-gl`.
- CSS import: `import "mapbox-gl/dist/mapbox-gl.css";` once at app entry.
- For the globe-replacement option, Mapbox supports `map.setProjection('globe')` and `map.setFog({...})` for an atmosphere effect similar to react-globe.gl.

---

**Before I implement, please confirm:**
1. Which screen should get the Mapbox map (A, B, or C above)?
2. Are you OK creating a Mapbox account and providing a public token (I'll request it as a secret when we start)?
