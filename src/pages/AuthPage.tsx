import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import logoImage from "@/assets/stampaway-logo.jpeg";

type AuthMode = "login" | "signup";
type Step = "form" | "otp" | "forgot" | "forgotOtp" | "resetPassword";

export default function AuthPage() {
  const {
    user,
    loading,
    mustCompletePasswordReset,
    beginPasswordReset,
    completePasswordReset,
  } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialMode: AuthMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<Step>(() => (mustCompletePasswordReset ? "resetPassword" : "form"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mustCompletePasswordReset) return;

    setMode("login");
    setStep("resetPassword");
    setOtpCode("");
  }, [mustCompletePasswordReset]);

  if (loading) return null;
  if (user && !mustCompletePasswordReset) return <Navigate to="/" replace />;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername) { toast.error(t("auth.usernameRequired")); return; }
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(trimmedUsername)) { toast.error(t("auth.usernameInvalid")); return; }
    if (!dateOfBirth) { toast.error(t("auth.dobRequired")); return; }
    setSubmitting(true);

    // Check username availability before creating the account
    const { data: available, error: checkError } = await supabase.rpc("is_username_available", { _username: trimmedUsername });
    if (checkError) { toast.error(checkError.message); setSubmitting(false); return; }
    if (!available) { toast.error(t("auth.usernameTaken")); setSubmitting(false); return; }

    const metadata = { username: trimmedUsername, date_of_birth: dateOfBirth };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: window.location.origin },
    });
    if (error) {
      const msg = /username_taken/i.test(error.message) ? t("auth.usernameTaken") : error.message;
      toast.error(msg);
      setSubmitting(false);
      return;
    }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      toast.error(t("auth.accountExists"));
      setMode("login");
      setSubmitting(false);
      return;
    }
    toast.success(t("auth.checkEmail"));
    setStep("otp");
    setSubmitting(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "signup" });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success(t("auth.verified"));
    setSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success(t("auth.codeSentEmail"));
    setStep("forgotOtp");
    setSubmitting(false);
  };

  const handleResetVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "recovery" });
    if (error) { toast.error(error.message); setSubmitting(false); return; }

    beginPasswordReset();
    setOtpCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setStep("resetPassword");
    setSubmitting(false);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error(t("toast.passwordTooShort")); return; }
    if (newPassword !== confirmNewPassword) { toast.error(t("toast.passwordMismatch")); return; }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    completePasswordReset();
    setNewPassword("");
    setConfirmNewPassword("");
    setSubmitting(false);
    toast.success(t("toast.passwordUpdated"));
    navigate("/", { replace: true });
  };

  const inputClass = "w-full bg-card rounded-xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary";
  const btnClass = "w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-lg ring-1 ring-white/10">
            <img src={logoImage} alt="Stampaway" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-brand text-4xl font-normal text-foreground tracking-tight mb-1">Stampaway</h1>
          <p className="text-sm text-muted-foreground">Log your adventures</p>
        </div>

        <AnimatePresence mode="wait">
          {step === "otp" && (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <button onClick={() => setStep("form")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <ChevronLeft className="w-4 h-4" /> {t("back")}
              </button>
              <p className="text-sm text-foreground font-medium">{t("auth.enterCode")}</p>
              <p className="text-xs text-muted-foreground">{t("auth.codeSentEmail")}</p>
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otpCode[i] || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const newCode = otpCode.split("");
                      newCode[i] = val;
                      setOtpCode(newCode.join("").slice(0, 6));
                      if (val && e.target.nextElementSibling) {
                        (e.target.nextElementSibling as HTMLInputElement).focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otpCode[i] && e.currentTarget.previousElementSibling) {
                        (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
                      }
                    }}
                    className="w-11 h-12 text-center text-lg font-bold bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  />
                ))}
              </div>
              <button onClick={handleVerifyOtp} disabled={submitting || otpCode.length !== 6} className={btnClass}>
                {submitting ? "..." : t("auth.verify")}
              </button>
            </motion.div>
          )}

          {step === "forgot" && (
            <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => { setStep("form"); setMode("login"); }} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                <ChevronLeft className="w-4 h-4" /> {t("back")}
              </button>
              <p className="text-sm font-medium text-foreground mb-1">{t("auth.forgotPassword")}</p>
              <p className="text-xs text-muted-foreground mb-4">{t("auth.forgotDesc")}</p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.email")} required className={inputClass} />
                <button type="submit" disabled={submitting} className={btnClass}>
                  {submitting ? "..." : t("auth.sendCode")}
                </button>
              </form>
            </motion.div>
          )}

          {step === "forgotOtp" && (
            <motion.div key="forgotOtp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <button onClick={() => setStep("forgot")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <ChevronLeft className="w-4 h-4" /> {t("back")}
              </button>
              <p className="text-sm text-foreground font-medium">{t("auth.enterResetCode")}</p>
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otpCode[i] || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const newCode = otpCode.split("");
                      newCode[i] = val;
                      setOtpCode(newCode.join("").slice(0, 6));
                      if (val && e.target.nextElementSibling) {
                        (e.target.nextElementSibling as HTMLInputElement).focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otpCode[i] && e.currentTarget.previousElementSibling) {
                        (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
                      }
                    }}
                    className="w-11 h-12 text-center text-lg font-bold bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  />
                ))}
              </div>
              <button onClick={handleResetVerifyOtp} disabled={submitting || otpCode.length !== 6} className={btnClass}>
                {submitting ? "..." : t("auth.verify")}
              </button>
            </motion.div>
          )}

          {step === "resetPassword" && (
            <motion.div key="resetPw" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="text-sm font-medium text-foreground mb-4">{t("auth.setNewPassword")}</p>
              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("settings.newPassword")} required minLength={6} className={`${inputClass} pr-10`} />
                <PasswordInput value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder={t("settings.confirmPassword")} required minLength={6} className={`${inputClass} pr-10`} />
                <button type="submit" disabled={submitting} className={btnClass}>
                  {submitting ? "..." : t("settings.updatePassword")}
                </button>
              </form>
            </motion.div>
          )}

          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <form onSubmit={mode === "login" ? handleSignIn : handleSignUp} className="space-y-4">
                {mode === "signup" && (
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.username")} className={inputClass} />
                )}

                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.email")} required className={inputClass} />

                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.password")} required minLength={6} className={`${inputClass} pr-10`} />

                {mode === "signup" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t("auth.dateOfBirth")}</label>
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required className={inputClass} />
                  </div>
                )}

                {mode === "login" && (
                  <button type="button" onClick={() => setStep("forgot")} className="text-xs text-primary font-medium">
                    {t("auth.forgotPassword")}
                  </button>
                )}

                <button type="submit" disabled={submitting} className={btnClass}>
                  {submitting ? "..." : mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
                </button>

                {mode === "signup" && (
                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
                    {t("auth.legalConsentPrefix")}{" "}
                    <button type="button" onClick={() => navigate("/terms")} className="text-primary underline-offset-2 hover:underline">
                      {t("auth.termsOfService")}
                    </button>
                    {" "}{t("auth.legalConsentAnd")}{" "}
                    <button type="button" onClick={() => navigate("/privacy")} className="text-primary underline-offset-2 hover:underline">
                      {t("auth.privacyPolicy")}
                    </button>
                    .
                  </p>
                )}
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
                <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-semibold">
                  {mode === "login" ? t("auth.signUp") : t("auth.signIn")}
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
