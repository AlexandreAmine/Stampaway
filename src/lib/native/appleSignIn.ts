import { SignInWithApple, type SignInWithAppleResponse } from "@capacitor-community/apple-sign-in";
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

export async function nativeAppleSignIn() {
  const res: SignInWithAppleResponse = await SignInWithApple.authorize({
    // iOS bundle id — used by Apple as the audience (`aud`) claim of the JWT.
    // Supabase's Apple provider must list this id as an allowed audience.
    clientId: "com.alexandreamine.stampaway",
    // Required field on the plugin, but ignored on device — the native sheet
    // does not perform a redirect. We use the web callback URL for consistency.
    redirectURI: "https://account.stampaway-app.com/auth/callback",
    scopes: "email name",
    state: crypto.randomUUID(),
  });

  const idToken = res.response.identityToken;
  if (!idToken) throw new Error("Apple did not return an identity token");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
  });
  if (error) throw error;
  return data;
}
