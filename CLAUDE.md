# Stampaway

Travel diary app. Vite + React + TypeScript → Capacitor → native iOS.
Supabase for all backend (Postgres, Auth, Edge Functions, Storage). No custom server.

## Standing constraints

- **iOS only.** Android is not a current target — don't spend effort there or "fix" Android build files.
- **Never change features or design** unless explicitly asked. Optimization work must be behaviour-identical and visually identical.
- **Never commit or push without explicit approval.** See Git discipline below.
- **Capgo OTA updates are disabled** (`CapacitorUpdater.autoUpdate: false` in `capacitor.config.ts`). Live updates previously broke the Apple Sign-In plugin. Do not re-enable without asking.

## Validation — required before calling any change done

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run test
npm run build
```

**The `-p tsconfig.app.json` is required.** The root `tsconfig.json` has `"files": []` and only
lists project references, so a bare `npx tsc --noEmit` checks nothing and always exits 0. And
`npm run build` does not type-check either (Vite strips types with esbuild). The type check has
**7 known pre-existing errors** (App.tsx, lib/mapboxLoader.ts, lib/posterWarmup.ts, AddPlacePage
×2, PlacePage ×2) — a change must not add to that count.

For anything touching native code or plugins, then run `npx cap sync ios`.

The iOS Simulator works for most visual verification: build with the simulator build tool
(`ios/App/App.xcodeproj`, scheme `App`, omit `device`), boot with
`xcrun simctl boot "iPhone 17 Pro"`, then attach and launch. The Mapbox globes render there.
It is a WKWebView, so there is no accessibility tree — verification is by screenshot.

The final gate is still a device test via TestFlight for haptics, real push, Apple Sign-In,
gesture feel and real-device performance — when a change depends on those, say the
verification is incomplete rather than claiming it works.

**Measuring perceived speed:** `src/lib/perfMarks.ts` logs `[perf]` timings (launch, auth,
splash, every navigation, when each screen's content is on screen, scroll restore). They are
compiled out of normal builds. Build with `VITE_PERF_MARKS=1 npm run build`, sync and install,
then run `scripts/measure-perf.sh [seconds]` and tap around in the Simulator while it records.
Rebuild without the variable before anything ships.

## Git discipline

- Never `git add .` — stage explicit paths only.
- Always exclude: `android/` build output, `android-backup-*` / `android-broken-*` folders, `*.backup`
  (these are covered by `.gitignore` now, but check `git status` before staging anyway).
- Show `git diff --cached --name-status` and wait for approval before committing.

## Architecture notes that change how you work

- **Supabase migrations are applied by hand** through the Supabase dashboard SQL editor — there is
  no `supabase` CLI on this machine. A file in `supabase/migrations/` is *not live* until it is run
  there. Frontend code depending on a new RPC must not ship before the SQL is applied.
- **`src/integrations/supabase/client.ts` is marked auto-generated** (Lovable). A Lovable sync can
  revert hand edits to it — re-check after any sync.
- **mapbox-gl:** do not use Vite `manualChunks` vendor splitting; it breaks both globes in the iOS
  WebView. Dynamic `import()` is the supported approach and is already in place (`src/lib/mapboxLoader.ts`).
- Data fetching is React Query (`staleTime: 0`, `gcTime` 30min, persisted to localStorage), with
  several hand-rolled caches in `src/lib/*Cache.ts` alongside it.
- Heaviest files, where most bugs concentrate: `ExplorePage.tsx` (1.4k lines), `ProfilePage.tsx` (1.1k),
  `MapTab.tsx` (855), `PlacePage.tsx` (751).
