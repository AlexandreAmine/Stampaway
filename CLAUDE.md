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
npx tsc --noEmit
npm run test
npm run build
```

For anything touching native code or plugins, then run `npx cap sync ios`.

The final gate is always a device test via TestFlight. The browser preview cannot exercise
authenticated screens, native gestures, haptics, push, or the Mapbox globes — when a change
depends on those, say the verification is incomplete rather than claiming it works.

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
