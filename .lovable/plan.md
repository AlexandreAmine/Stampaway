

# Plan: Import City Descriptions from DOCX

## Summary
Parse the uploaded DOCX file containing descriptions for ~950 cities (top 5 per country, ~190 countries) and update each city's `description` column in the `places` table. The frontend already displays DB descriptions when present (same logic used for countries).

## Steps

1. **Parse the DOCX and extract city-country-description mappings**
   - Read the full parsed document content (2833 lines)
   - Extract each city name, its parent country heading, and the description text (everything after the "CityName — " or standalone paragraph)
   - Handle edge cases: truncated descriptions at page boundaries, cities with special characters, multi-word city names

2. **Batch-update the `places` table**
   - For each extracted city, run UPDATE queries matching on `name`, `country`, and `type = 'city'`
   - Handle country name variants (e.g., "Bosnia and Herzegovina", "Cote d'Ivoire", etc.)
   - Process in batches of ~50 cities per SQL statement to stay within limits
   - Use the Supabase insert tool (for data updates, not migrations)

3. **Verify the updates**
   - Query a sample of updated cities to confirm descriptions are stored
   - No frontend changes needed -- `PlacePage.tsx` already reads the `description` field and displays it for both countries and cities

## Technical Details
- The document was truncated at page 50 (out of likely ~60 pages), so some countries from O-Z may be missing. The last visible entries are Pakistan and Palestine. Cities from countries after Palestine won't have descriptions unless the full document is processed.
- The `fetchDescription` function in `PlacePage.tsx` (line 237) already checks `dbDescription` first and falls back to Wikipedia, so no code changes are needed.

