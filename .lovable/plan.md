## Add Pexels as a poster source + generate Georgia cities

### What we'll build

1. **Store the Pexels API key** as a Supabase secret (`PEXELS_API_KEY`). You shared it in chat — I'll add it via the secret tool so it's not hardcoded in the repo.

2. **New edge function `fetch-pexels-poster`** — same shape as `fetch-unsplash-poster`:
   - Takes `place_id`, looks up the place
   - Skips if `places.image` is already set (unless `force: true`)
   - Loads all currently-used Pexels photo IDs from `places.image` to enforce **uniqueness across the whole DB** (no duplicate poster anywhere)
   - Queries Pexels `/v1/search` with multiple wide-shot queries:
     - `"{name} {country} aerial cityscape skyline"`
     - `"{name} {country} city skyline panorama"`
     - `"{name} {country} cityscape"`
     - `"{name} {country}"`
   - Per query: `per_page=80`, `orientation=portrait` (matches the 3:4 poster), `size=large`
   - Filters out photos whose `alt` mentions people (`person`, `selfie`, `portrait of`, `wedding`, `bride`, `groom`, `model`, `man`, `woman`, `couple`)
   - Scores remaining photos: base score + bonuses for wide-shot keywords (`skyline`, `cityscape`, `aerial`, `panorama`, `drone`, `view`, `downtown`, `harbor`) − penalties for narrow shots (`close-up`, `interior`, `facade`, `door`, `window`, `food`, `statue`, `detail`)
   - Picks highest score not already used; saves the Pexels CDN URL into `places.image`
   - Returns `{ image_url, photo_id, photographer }`

3. **Update `DestinationPoster.tsx`** to add a `provider` prop (`"unsplash" | "pexels"`, default `"unsplash"`) so existing behavior is unchanged. When `provider="pexels"` it calls the new function instead.

4. **Generate all Georgia city posters now** — once the function is deployed, I'll:
   - Query: `select id from places where type='city' and country='Georgia'`
   - For each, invoke `fetch-pexels-poster` with `force: true` (overwrites whatever is currently cached, since you want the best Pexels result)
   - Run sequentially with a small delay to respect Pexels' 200 req/hour free tier

### Why Pexels works well here

- Separate quota from Unsplash → no interference with what we already built
- Free tier: 200/hour, 20k/month — plenty for a one-shot Georgia regen
- Different photographer pool → cities Unsplash had weak results for (small Georgian towns) will get fresh coverage
- Uniqueness check still runs DB-wide, so a Pexels poster won't collide with an existing Unsplash one (different URL patterns; we extract Pexels photo ID separately)

### Open question

**Q: Do you want Pexels to be the source going forward for all cities (everywhere in the app), or only for this Georgia regen?**
- **Option A — Georgia only now**: I add the function, regen Georgia, leave the rest of the app on Unsplash. Safer, lets you compare.
- **Option B — Switch all city posters to Pexels**: I change `DestinationPoster` default to `pexels` so any new auto-generation across the app uses Pexels. Existing cached images stay until you wipe them.

I recommend **A** — regen Georgia, see if you prefer the look, then decide.

### Files touched

- `supabase/functions/fetch-pexels-poster/index.ts` (new)
- `src/components/DestinationPoster.tsx` (add `provider` prop)
- New secret: `PEXELS_API_KEY`
- One-shot DB script run: invoke function for every Georgia city
