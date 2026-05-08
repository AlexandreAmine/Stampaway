import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { WelcomeGlobe } from "@/components/WelcomeGlobe";
import logoImage from "@/assets/stampaway-logo.jpeg";

export default function WelcomePage() {
  const { user, loading, mustCompletePasswordReset } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 380, h: 380 });

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
          <p className="text-sm text-muted-foreground mt-1">Log & rate your trips</p>
        </div>

        {/* Globe */}
        <div ref={containerRef} className="w-full relative my-2">
          <WelcomeGlobe width={size.w} height={size.h} />
        </div>

        {/* Buttons */}
        <div className="space-y-3 pb-10 mt-auto pt-4">
          <button
            onClick={() => navigate("/auth?mode=login")}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="w-full bg-card text-foreground border border-border rounded-xl py-3.5 text-sm font-semibold hover:bg-card/80 transition-colors"
          >
            Create Account
          </button>
        </div>
      </motion.div>
    </div>
  );
}
