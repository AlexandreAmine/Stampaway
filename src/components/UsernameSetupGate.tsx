import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import logoImage from "@/assets/stampaway-logo.jpeg";

export default function UsernameSetupGate() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user || !profile?.needs_username) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(trimmed)) {
      toast.error(t("auth.usernameInvalid"));
      return;
    }
    setSubmitting(true);
    const { data: available, error: checkErr } = await supabase.rpc("is_username_available", { _username: trimmed });
    if (checkErr) { toast.error(checkErr.message); setSubmitting(false); return; }
    if (!available) { toast.error(t("auth.usernameTaken")); setSubmitting(false); return; }

    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed, needs_username: false })
      .eq("user_id", user.id);
    if (error) { toast.error(error.message); setSubmitting(false); return; }

    await refreshProfile();
    setSubmitting(false);
  };

  const inputClass = "w-full bg-card rounded-xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-lg ring-1 ring-white/10">
            <img src={logoImage} alt="Stampaway" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-brand text-3xl font-normal text-foreground tracking-tight mb-2">Choose a username</h1>
          <p className="text-sm text-muted-foreground">Pick a unique username to finish setting up your account.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("auth.username")}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "..." : t("auth.continue") || "Continue"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
