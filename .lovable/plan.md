## Goal
Switch the iOS/Android Bundle ID from the rejected `app.stampaway.mobile` to `com.stampaway.app`, so Apple will accept the App ID registration.

## Code change
**File:** `capacitor.config.ts`
- Change `appId: "app.stampaway.mobile"` → `appId: "com.stampaway.app"`

That is the only file I will edit.

## What you do after I apply the change

### 1. Pull + rebuild native projects (Mac Terminal, inside your `Stampaway` folder)

Run these one at a time:

```bash
git pull
```

```bash
npm run build
```

Because the appId changed, the safest path is to regenerate the iOS folder:

```bash
rm -rf ios && npx cap add ios && npx cap sync ios
```

(Same for Android when you're ready: `rm -rf android && npx cap add android && npx cap sync android`.)

### 2. Register the new Bundle ID with Apple

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click **+** → **App IDs** → **App** → Continue
3. **Description:** `Stampaway`
4. **Bundle ID:** Explicit → `com.stampaway.app`
5. Capabilities: tick **Push Notifications** and **Sign In with Apple**
6. Continue → Register

### 3. Reopen Xcode

```bash
npx cap open ios
```

In Xcode → **App** target → **Signing & Capabilities**:
- Confirm Bundle Identifier shows `com.stampaway.app`
- Team: ALEXANDRE KARL AMINE
- Click **Try Again** if any red errors remain — they should clear within ~10 seconds

### 4. Continue with the App Store steps I gave you previously
(Steps 3–7 from my last message: version/icon/App Store Connect listing/Archive/Upload/Submit. Just use `com.stampaway.app` instead of the old ID when creating the App Store Connect entry.)

## Notes
- `com.stampaway.app` is permanent — Apple and Google will tie the app to it forever.
- Capgo OTA updates will continue to work; re-run the Capgo onboarding once after the new iOS folder is generated so it picks up the new App ID.
- You have not uploaded any build yet, so changing the Bundle ID now is free of consequences.
