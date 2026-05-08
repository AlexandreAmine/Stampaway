## Goal
Change the Capacitor App ID from the invalid `app.lovable.29bacedb019c46d6a9a8dea7867a9954` to a clean, store-ready `app.stampaway.mobile`, then add iOS and Android native platforms.

## What I will change in the codebase
**File:** `capacitor.config.ts`
- Change `appId: "app.lovable.29bacedb019c46d6a9a8dea7867a9954"` → `appId: "app.stampaway.mobile"`

That's the only code change needed.

## What you will paste in Terminal (after I apply the change)

After clicking "Implement plan", wait until I confirm the change is done, then in your Mac Terminal (inside the `Stampaway` folder) run these commands **one at a time**:

```bash
git pull
```

```bash
git add capacitor.config.ts && git commit -m "chore: set clean app id"
```

```bash
npx cap add ios
```

```bash
npx cap add android
```

After all four finish successfully, tell me "done" and I'll guide you through the next step (building the app and opening it in Xcode).

## Notes
- `app.stampaway.mobile` is permanent — it's the bundle ID Apple and Google will use forever for this app. If you'd prefer a different one (e.g. `com.yourname.stampaway`), tell me before approving and I'll use that instead.
- Capgo will still work — when we re-run the Capgo onboarding it will pick up the new App ID automatically.
