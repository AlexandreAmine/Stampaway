import {
  AppleSignIn,
  ErrorCode,
  SignInScope,
} from "@capawesome/capacitor-apple-sign-in";
import { supabase } from "@/integrations/supabase/client";
import { isIOS, isNative } from "./platform";

/**
 * Native Sign in with Apple for the installed iOS Capacitor app.
 *
 * On the web (including the custom domain account.stampaway-app.com) we keep
 * using the Lovable Cloud OAuth broker via `lovable.auth.signInWithOAuth("apple")`.
 *
 * On iOS the broker redirects back to `capacitor://localhost?...` which the
 * WKWebView resolves to the bundled index.html and the SPA renders NotFound —
 * the "Oops page not found" the user reported. To avoid the broker entirely we
 * present Apple's native ASAuthorizationController via this plugin and exchange
 * the returned identity token for a Supabase session.
 */
export const canUseNativeAppleSignIn = (): boolean => isNative() && isIOS();

export function isNativeAppleSignInCanceled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const nativeError = error as {
    code?: unknown;
    error?: unknown;
  };

  return (
    nativeError.code === ErrorCode.SignInCanceled ||
    nativeError.code === "1001" ||
    nativeError.code === 1001 ||
    nativeError.error === "1001" ||
    nativeError.error === 1001
  );
}

export async function nativeAppleSignIn() {
  const result = await AppleSignIn.signIn({
    scopes: [SignInScope.Email, SignInScope.FullName],
  });

  if (!result.idToken) throw new Error("Apple did not return an identity token");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: result.idToken,
  });
  if (error) throw error;
  return data;
}
