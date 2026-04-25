/**
 * Central re-exports for every Capacitor plugin we install.
 *
 * Always import from here (not from the individual @capacitor/* packages) so
 * we have one place to swap implementations or add web-side fallbacks later.
 *
 * All of these are safe to import in the browser preview — calling them on
 * web will either no-op or throw a recoverable error that our hooks handle.
 */
export { App } from "@capacitor/app";
export { Browser } from "@capacitor/browser";
export { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
export { Contacts } from "@capacitor-community/contacts";
export { Device } from "@capacitor/device";
export { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
export { Geolocation } from "@capacitor/geolocation";
export { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
export { Keyboard } from "@capacitor/keyboard";
export { Network } from "@capacitor/network";
export { Preferences } from "@capacitor/preferences";
export { PushNotifications } from "@capacitor/push-notifications";
export { Share } from "@capacitor/share";
export { SplashScreen } from "@capacitor/splash-screen";
export { StatusBar, Style as StatusBarStyle } from "@capacitor/status-bar";

export * from "./platform";
