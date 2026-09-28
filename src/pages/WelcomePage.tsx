import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { WelcomeGlobe } from "@/components/WelcomeGlobe";
import { AppleLogo } from "@/components/AppleLogo";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import {
  canUseNativeAppleSignIn,
  isNativeAppleSignInCanceled,
  nativeAppleSignIn,
} from "@/lib/native/appleSignIn";
import logoImage from "@/assets/stampaway-logo.jpeg";
import { useAfterFirstPaint } from "@/hooks/useAfterFirstPaint";

export default function WelcomePage() {
  const { user, loading, mustCompletePasswordReset } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 380, h: 380 });
  const globeReady = useAfterFirstPaint();

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      setSize({ w, h: Math.round(w * 1.05) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (loading) return null;
  if (user && !mustCompletePasswordReset) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex-1 flex flex-col"
      >
        {/* Logo + wordmark */}
        <div className="text-center pt-12 pb-4 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3 shadow-lg ring-1 ring-white/10">
            <img src={logoImage} alt="Stampaway" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-brand text-3xl font-normal text-foreground tracking-tight">Stampaway</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("welcome.tagline")}</p>
        </div>

        {/* Globe — mounted one frame after the page shell paints, so the
            logo/buttons appear instantly instead of waiting on WebGL setup.
            The placeholder reserves the exact same space (no layout shift). */}
        <div ref={containerRef} className="w-full relative my-2">
          {globeReady ? (
            <WelcomeGlobe width={size.w} height={size.h} />
          ) : (
            <div style={{ width: size.w, height: size.h }} />
          )}
        </div>

        {/* Actions: Apple first and most prominent, account creation second,
            and sign-in for returning users as a quieter link underneath. */}
        <div className="pb-10 mt-auto pt-4">
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  if (canUseNativeAppleSignIn()) {
                    await nativeAppleSignIn();
                  } else {
                    const result = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
                    if (result.error) toast.error(result.error.message);
                  }
                } catch (e: any) {
                  if (!isNativeAppleSignInCanceled(e)) {
                    toast.error(e?.message ?? t("auth.appleFailed"));
                  }
                }
              }}
              className="w-full bg-white text-black rounded-xl py-3.5 text-[15px] font-semibold hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <AppleLogo className="w-[18px] h-[18px]" />
              {t("auth.continueWithApple")}
            </button>
            <button
              onClick={() => navigate("/auth?mode=signup")}
              className="w-full bg-card text-foreground border border-border rounded-xl py-3.5 text-[15px] font-semibold hover:bg-card/80 active:scale-[0.98] transition-all"
            >
              {t("auth.createAccount")}
            </button>
          </div>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <button
              onClick={() => navigate("/auth?mode=login")}
              className="font-semibold text-primary py-2 -my-2"
            >
              {t("welcome.signInLink")}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
