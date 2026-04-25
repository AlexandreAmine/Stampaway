# Stampaway

Social travel app — log destinations, follow friends, get inspired.

Built on **Lovable** (web preview + edits) and packaged as a native iOS / Android app via **Capacitor**.

---

## Native mobile setup (one-time, on your own machine)

All Capacitor plugins and config are already installed in this repo. You only need to do the steps below the first time, on your Mac (for iOS) or any machine with Android Studio (for Android).

### Prerequisites

- **Node.js 18+** and `npm`
- **iOS**: macOS with **Xcode 15+**
- **Android**: **Android Studio** (latest)

### Steps

```bash
# 1. Pull the latest code from your GitHub export of this Lovable project
git clone <your-repo-url>
cd <your-repo>

# 2. Install JS dependencies
npm install

# 3. Add the native platforms (creates ios/ and android/ folders)
npx cap add ios
npx cap add android

# 4. Build the web bundle and sync it into the native projects
npm run build
npx cap sync

# 5. Open the native IDE
npx cap open ios       # opens Xcode
npx cap open android   # opens Android Studio
```

From there, configure signing in Xcode / Android Studio and submit to the App Store / Play Store.

### After every Lovable change

Once the native projects exist, syncing future Lovable updates is one command:

```bash
git pull
npm install
npm run build
npx cap sync
```

> **Live updates**: While the `server.url` block is enabled in `capacitor.config.ts`, the installed app loads directly from the Lovable preview URL — so most UI / logic changes appear instantly without rebuilding. **Disable that block before shipping the production build to the stores** (see comment in `capacitor.config.ts`).

---

## Required permission strings

Paste these into the native project files **once** (Xcode / Android Studio will not generate them automatically):

### iOS — `ios/App/App/Info.plist`

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Stampaway uses your location to suggest nearby places to log.</string>

<key>NSContactsUsageDescription</key>
<string>Stampaway uses your contacts to suggest friends already on the app.</string>

<key>NSCameraUsageDescription</key>
<string>Stampaway uses your camera to set a profile picture.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Stampaway uses your photo library to set a profile picture.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Stampaway saves destination posters to your photo library.</string>

<key>NSUserTrackingUsageDescription</key>
<string>Allow Stampaway to deliver more relevant travel suggestions.</string>
```

Push notifications also require enabling **Push Notifications** + **Background Modes → Remote notifications** capabilities in Xcode and uploading an APNs key in your Apple Developer account.

### Android — `android/app/src/main/AndroidManifest.xml`

Inside the `<manifest>` element, before `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Push notifications additionally require setting up **Firebase Cloud Messaging** and adding the `google-services.json` to `android/app/`.

---

## Installed Capacitor plugins

| Plugin | Use case |
|---|---|
| `@capacitor/push-notifications` | Friend activity, follow requests, comments |
| `@capacitor/geolocation` | Auto-detect place when logging, friend map |
| `@capacitor-community/contacts` | Suggest friends from phone contacts |
| `@capacitor/share` | Share profile, lists, destinations |
| `@capacitor/camera` | Profile picture, future place photos |
| `@capacitor/haptics` | Tactile feedback |
| `@capacitor/status-bar` | Themed status bar |
| `@capacitor/splash-screen` | Branded launch screen |
| `@capacitor/app` | Deep linking, app lifecycle |
| `@capacitor/preferences` | Fast on-device storage |
| `@capacitor/network` | Offline detection |
| `@capacitor/device` | Device info |
| `@capacitor/keyboard` | Keyboard handling |
| `@capacitor/browser` | In-app browser for OAuth |
| `@capacitor/filesystem` | Save posters / exports |

All plugins are accessed through `src/lib/native/` and the `useNativeFeatures()` hook (`src/hooks/useNativeFeatures.ts`), which gracefully no-op on the web preview.

---

## Lovable web project

- **Preview**: <https://id-preview--29bacedb-019c-46d6-a9a8-dea7867a9954.lovable.app>
- **Published**: <https://wander-logbook-72.lovable.app>
- **Edit**: open the project in [Lovable](https://lovable.dev) and chat your changes.
