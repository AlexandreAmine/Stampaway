import { Suspense, lazy, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { hasSeenIntro, hasSeenIntroSync, markIntroSeen } from "@/lib/onboarding";

// Runs once per device, so it has no business in the entry bundle — the panels
// and their imagery load only for someone actually seeing them.
const OnboardingFlow = lazy(() => import("./OnboardingFlow"));

/**
 * First-launch intro, shown before account creation.
 *
 * Only ever appears to someone who is signed out: anyone who already has a
 * session is past the point this is for, and they're marked as having seen it
 * so that signing out later never surfaces it. That also covers existing users
 * updating the app — they're signed in, so they never see it.
 */
export default function OnboardingGate() {
  const { user, loading } = useAuth();
  const [show, setShow] = useState(false);
  const signedIn = !!user;

  useEffect(() => {
    // Wait for the session to resolve, or a signed-in user would see a flash
    // of the intro before their session loads.
    if (loading) return;

    if (signedIn) {
      setShow(false);
      if (!hasSeenIntroSync()) void markIntroSeen();
      return;
    }

    let cancelled = false;
    hasSeenIntro().then((seen) => {
      if (!cancelled) setShow(!seen);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, signedIn]);

  if (!show) return null;

  return (
    <Suspense fallback={null}>
      <OnboardingFlow
        onFinish={() => {
          setShow(false);
          void markIntroSeen();
        }}
      />
    </Suspense>
  );
}
