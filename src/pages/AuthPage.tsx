import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, ChevronLeft } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";

type AuthMode = "login" | "signup";
type AuthMethod = "email" | "phone";
type Step = "form" | "otp" | "forgot" | "forgotOtp" | "resetPassword";

export default function AuthPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("login");
  const [method, setMethod] = useState<AuthMethod>("email");
  const [step, setStep] = useState<Step>("form");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  if (loading) return null;
  if (user && !resettingPassword) return <Navigate to="/" replace />;

  const resetForm = () => {
    setEmail("");
    setPhone("");
    setPassword("");
    setUsername("");
    setDateOfBirth("");
    setOtpCode("");
    setNewPassword("");
    setStep("form");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { toast.error(t("auth.usernameRequired")); return; }
    if (!dateOfBirth) { toast.error(t("auth.dobRequired")); return; }
    setSubmitting(true);

    const metadata = { username, date_of_birth: dateOfBirth };

    if (method === "email") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata, emailRedirectTo: window.location.origin },
      });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      // Supabase returns a fake user with no identities if the email already exists
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error(t("auth.accountExists"));
        setMode("login");
        setSubmitting(false);
        return;
      }
      toast.success(t("auth.checkEmail"));
      setStep("otp");
    } else {
      const { data, error } = await supabase.auth.signUp({
        phone,
        password,
        options: { data: metadata },
      });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error(t("auth.accountExistsPhone"));
        setMode("login");
        setSubmitting(false);
        return;
      }
      toast.success(t("auth.checkPhone"));
      setStep("otp");
    }
    setSubmitting(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (method === "email") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ phone, password });
      if (error) toast.error(error.message);
    }
    setSubmitting(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setSubmitting(true);

    if (method === "email") {
      const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "signup" });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      toast.success(t("auth.verified"));
    } else {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otpCode, type: "sms" });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      toast.success(t("auth.verified"));
    }
    setSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (method === "email") {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      toast.success(t("auth.codeSentEmail"));
      setStep("forgotOtp");
    } else {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      toast.success(t("auth.resetPhoneSent"));
      setStep("forgotOtp");
    }
    setSubmitting(false);
  };

  const handleResetVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setSubmitting(true);

    if (method === "email") {
      const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "recovery" });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      setResettingPassword(true);
      setStep("resetPassword");
    } else {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otpCode, type: "sms" });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      setResettingPassword(true);
      setStep("resetPassword");
    }
    setSubmitting(false);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error(t("toast.passwordTooShort")); return; }
    if (newPassword !== confirmNewPassword) { toast.error(t("toast.passwordMismatch")); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); } else {
      toast.success(t("toast.passwordUpdated"));
      setResettingPassword(false);
      navigate("/", { replace: true });
    }
    setSubmitting(false);
  };

  const inputClass = "w-full bg-card rounded-xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary";
  const btnClass = "w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">TravelD</h1>
          <p className="text-sm text-muted-foreground">Log your adventures</p>
        </div>

        <AnimatePresence mode="wait">
          {/* OTP verification after signup */}
          {step === "otp" && (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <button onClick={() => setStep("form")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <ChevronLeft className="w-4 h-4" /> {t("back")}
              </button>
              <p className="text-sm text-foreground font-medium">{t("auth.enterCode")}</p>
              <p className="text-xs text-muted-foreground">{method === "email" ? t("auth.codeSentEmail") : t("auth.codeSentPhone")}</p>
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

          {/* Forgot password form */}
          {step === "forgot" && (
            <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => { setStep("form"); setMode("login"); }} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                <ChevronLeft className="w-4 h-4" /> {t("back")}
              </button>
              <p className="text-sm font-medium text-foreground mb-1">{t("auth.forgotPassword")}</p>
              <p className="text-xs text-muted-foreground mb-4">{t("auth.forgotDesc")}</p>

              {/* Method toggle */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => setMethod("email")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${method === "email" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button onClick={() => setMethod("phone")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${method === "phone" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                  <Phone className="w-4 h-4" /> {t("auth.phone")}
                </button>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                {method === "email" ? (
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.email")} required className={inputClass} />
                ) : (
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("auth.phonePlaceholder")} required className={inputClass} />
                )}
                <button type="submit" disabled={submitting} className={btnClass}>
                  {submitting ? "..." : t("auth.sendCode")}
                </button>
              </form>
            </motion.div>
          )}

          {/* Forgot password OTP */}
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

          {/* Reset password */}
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

          {/* Main login/signup form */}
          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Method toggle */}
              <div className="flex gap-2 mb-5">
                <button onClick={() => setMethod("email")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${method === "email" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button onClick={() => setMethod("phone")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${method === "phone" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                  <Phone className="w-4 h-4" /> {t("auth.phone")}
                </button>
              </div>

              <form onSubmit={mode === "login" ? handleSignIn : handleSignUp} className="space-y-4">
                {mode === "signup" && (
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.username")} className={inputClass} />
                )}

                {method === "email" ? (
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.email")} required className={inputClass} />
                ) : (
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("auth.phonePlaceholder")} required className={inputClass} />
                )}

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
