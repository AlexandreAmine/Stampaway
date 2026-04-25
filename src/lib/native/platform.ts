import { Capacitor } from "@capacitor/core";

/**
 * Platform detection helpers.
 *
 * These work in both the Lovable browser preview and the installed native app.
 * `isNative()` returns false in the browser, so any native-only code path
 * (push permission prompts, geolocation, contacts pickers) gracefully no-ops
 * during web development.
 */
export const isNative = (): boolean => Capacitor.isNativePlatform();
export const isIOS = (): boolean => Capacitor.getPlatform() === "ios";
export const isAndroid = (): boolean => Capacitor.getPlatform() === "android";
export const isWeb = (): boolean => Capacitor.getPlatform() === "web";

export const platformName = (): "ios" | "android" | "web" =>
  Capacitor.getPlatform() as "ios" | "android" | "web";
