# Capacitor Native Setup for Stampaway

Goal: Install every native plugin we might ever need **before** the first store submission, so future Lovable changes flow live to installed apps without resubmitting (except for major native upgrades).

---

## 1. Install Capacitor core + platforms

Add to `package.json`:

- `@capacitor/core`
- `@capacitor/cli` (dev)
- `@capacitor/ios`
- `@capacitor/android`

## 2. Install all native plugins (one-time, baked into the binary)


| Plugin                          | Purpose for Stampaway                       |
| ------------------------------- | ------------------------------------------- |
| `@capacitor/push-notifications` | Friend activity, follow requests, comments  |
| `@capacitor/geolocation`        | Auto-detect place when logging, friend map  |
| `@capacitor-community/contacts` | Suggest friends from phone contacts         |
| `@capacitor/share`              | Share profile, lists, destinations, posters |
| `@capacitor/camera`             | Profile picture, future place photos        |
| `@capacitor/haptics`            | Tactile feedback on key actions             |
| `@capacitor/status-bar`         | Dark themed status bar                      |
| `@capacitor/splash-screen`      | Branded launch screen                       |
| `@capacitor/app`                | Deep linking, back button, app state        |
| `@capacitor/preferences`        | Fast on-device key/value storage            |
| `@capacitor/network`            | Detect offline state, queue actions         |
| `@capacitor/device`             | Device info for analytics + bug reports     |
| `@capacitor/keyboard`           | Smooth keyboard handling on inputs          |
| `@capacitor/browser`            | In-app browser for OAuth + external links   |
| `@capacitor/filesystem`         | Save posters, export user data              |


## 3. Create `capacitor.config.ts`

```text
appId:   app.lovable.29bacedb019c46d6a9a8dea7867a9954
appName: Stampaway
webDir:  dist
server:
  url: https://29bacedb-019c-46d6-a9a8-dea7867a9954.lovableproject.com?forceHideBadge=true
  cleartext: true
plugins:
  SplashScreen: dark theme, branded
  StatusBar:    dark style
  PushNotifications: alert + badge + sound
```

## 4. Light integration code (no forced UI yet)

- `src/lib/native/index.ts` — central exports for all Capacitor plugins
- `src/hooks/useNativeFeatures.ts` — helpers: `requestNotifications()`, `getCurrentLocation()`, `pickContacts()`, `share()`, `takePhoto()`, etc.
- `src/lib/native/platform.ts` — `isNative()`, `isIOS()`, `isAndroid()` checks so the same code runs in browser + app

These are NOT auto-wired into UI yet — they're available for when we build features (notifications toggle in Settings, geolocation in AddPlacePage, contact-based friend suggestions, etc.).

## 5. README instructions for your one-time local setup

A new section explaining the export-to-GitHub → `npx cap add ios/android` → Xcode/Android Studio → store submit flow, with copy-paste commands.

---

## What this enables going forward

After your first store submission:

- **Live via Lovable (no resubmit)**: UI, copy, translations, new pages, AI planner, Mapbox globe, destination data, posters, edge functions, database, RLS, recommendations, notification *content*, how location/contacts/share are *used*.
- **Requires resubmit (rare)**: Adding a brand-new native plugin not in the list above, Capacitor major version upgrades, iOS/Android SDK target bumps (~once a year for store compliance).

---

## What I will NOT do in this step

- Will not auto-add iOS/Android folders (must be generated on your Mac/PC via `npx cap add`)
- Will not request notification/location/contacts permissions yet — that happens when each feature is built
- Will not configure push notification certificates (APNs/FCM) — done later when push UI is built
- Will not modify privacy policy / terms text — separate task

---

## Technical notes

- All plugin permission strings (NSLocationWhenInUseUsageDescription, NSContactsUsageDescription, NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSUserTrackingUsageDescription, push notification entitlements, Android `ACCESS_FINE_LOCATION`, `READ_CONTACTS`, `CAMERA`, `POST_NOTIFICATIONS`) will be documented in the README so you paste them into `Info.plist` and `AndroidManifest.xml` once during local setup.
- Hot-reload `server.url` in `capacitor.config.ts` should be **removed before production build** — README will explain. For dev/testing it stays.
- `useNativeFeatures` will gracefully no-op in the web preview so nothing breaks in Lovable's browser preview.