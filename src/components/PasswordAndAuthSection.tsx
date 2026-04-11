import { useState, useEffect } from "react";
import { ChevronLeft, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PasswordInput } from "@/components/PasswordInput";
import type { User } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  t: (key: string) => string;
  onBack: () => void;
}

export function PasswordAndAuthSection({ user, t, onBack }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // 2FA state
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [loading2FA, setLoading2FA] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    setLoading2FA(true);
    const { data } = await supabase.auth.mfa.listFactors();
    if (data) {
      const verified = data.totp.find(f => f.status === "verified");
      if (verified) {
        setHas2FA(true);
        setFactorId(verified.id);
      }
    }
    setLoading2FA(false);
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (newPassword !== confirmPassword) { toast.error(t("toast.passwordMismatch")); return; }
    if (newPassword.length < 6) { toast.error(t("toast.passwordTooShort")); return; }
    setChangingPassword(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email!, password: currentPassword });
    if (signInErr) { toast.error(t("toast.wrongPassword")); setChangingPassword(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(t("toast.passwordFailed")); } else { toast.success(t("toast.passwordUpdated")); }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setChangingPassword(false);
  };

  const handleEnroll2FA = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "TravelD App" });
    if (error) { toast.error(error.message); setEnrolling(false); return; }
    setTotpUri(data.totp.uri);
    setTotpSecret(data.totp.secret);
    setFactorId(data.id);
    setEnrolling(false);
  };

  const handleVerify2FA = async () => {
    if (!factorId || verifyCode.length !== 6) return;
    setVerifying2FA(true);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr) { toast.error(challengeErr.message); setVerifying2FA(false); return; }
    const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: verifyCode });
    if (verifyErr) { toast.error(verifyErr.message); setVerifying2FA(false); return; }
    toast.success(t("settings.2faEnabled"));
    setHas2FA(true);
    setTotpUri(null);
    setTotpSecret(null);
    setVerifyCode("");
    setVerifying2FA(false);
  };

  const handleDisable2FA = async () => {
    if (!factorId) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { toast.error(error.message); return; }
    toast.success(t("settings.2faDisabled"));
    setHas2FA(false);
    setFactorId(null);
  };

  // Generate QR code URL using a public API
  const qrUrl = totpUri ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}` : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="text-xl font-bold text-foreground">{t("settings.changePassword")}</h1>
        </div>

        {/* Change password */}
        <p className="text-xs text-muted-foreground mb-4">{user?.email}</p>
        <div className="space-y-4 mb-8">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("settings.currentPassword")}</label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("settings.newPassword")}</label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("settings.confirmPassword")}</label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword} className="w-full">
            {changingPassword ? t("settings.updating") : t("settings.updatePassword")}
          </Button>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-6" />

        {/* Two-Factor Authentication */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {t("settings.twoFactorAuth")}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">{t("settings.twoFactorDesc")}</p>

          {loading2FA ? (
            <div className="h-10 flex items-center">
              <span className="text-sm text-muted-foreground">{t("loading")}</span>
            </div>
          ) : has2FA ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">{t("settings.2faEnabled")}</span>
              </div>
              <Button variant="outline" onClick={handleDisable2FA} className="w-full text-destructive border-destructive/30">
                <ShieldOff className="w-4 h-4 mr-2" />
                {t("settings.disable2FA")}
              </Button>
            </div>
          ) : totpUri ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">{t("settings.scan2FACode")}</p>
              {qrUrl && (
                <div className="flex justify-center">
                  <img src={qrUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-xl border border-border" />
                </div>
              )}
              {totpSecret && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
                  <p className="text-xs font-mono text-foreground break-all select-all">{totpSecret}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("settings.enter2FACode")}</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-lg font-mono tracking-widest"
                />
              </div>
              <Button onClick={handleVerify2FA} disabled={verifying2FA || verifyCode.length !== 6} className="w-full">
                {verifying2FA ? t("settings.updating") : t("settings.verify2FA")}
              </Button>
            </div>
          ) : (
            <Button onClick={handleEnroll2FA} disabled={enrolling} className="w-full">
              <ShieldCheck className="w-4 h-4 mr-2" />
              {enrolling ? t("settings.updating") : t("settings.enable2FA")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
