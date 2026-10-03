import { useState } from "react";
import { hapticSuccess } from "@/lib/haptics";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";

// `value` is what gets stored in `reports.reason` and stays English so
// moderation reads one language; only the label shown is translated.
type Reason = { value: string; label: TranslationKey };

const ACCOUNT_REASONS: Reason[] = [
  { value: "Account exhibits a pattern of posting unwelcome, aggressive or abusive remarks directed at another member", label: "report.account.abusive" },
  { value: "Account exhibits a pattern of posting racist, sexist, homophobic or other discriminatory views (including white nationalist ideologies)", label: "report.account.discriminatory" },
  { value: "Account exhibits a pattern of plagiarism (please include link/s to original content)", label: "report.account.plagiarism" },
  { value: "Account promotes piracy or other illegal activity", label: "report.account.illegal" },
  { value: "Account is attempting to manipulate destination ratings or popularity (by following an excessive number of accounts)", label: "report.account.manipulation" },
  { value: "Account is posting unsolicited links to content, products or services, including for self-promotion", label: "report.account.spam" },
  { value: "Account is an impersonation, satire or parody", label: "report.account.impersonation" },
  { value: "Account has attempted to solicit personal information from a member (please include a relevant link)", label: "report.account.personalInfo" },
  { value: "Account has an offensive username or bio", label: "report.account.offensiveProfile" },
  { value: "Other", label: "common.otherOption" },
];

const REVIEW_REASONS: Reason[] = [
  { value: "Contains abuse", label: "report.review.abuse" },
  { value: "Contains violent words", label: "report.review.violent" },
  { value: "Contains plagiarism", label: "report.review.plagiarism" },
  { value: "Contains spam", label: "report.review.spam" },
  { value: "Other reason", label: "report.review.otherReason" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "account" | "review";
  targetId: string;
  targetUserId?: string;
}

export function ReportSheet({ open, onOpenChange, targetType, targetId, targetUserId }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reason, setReason] = useState<Reason | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reasons = targetType === "account" ? ACCOUNT_REASONS : REVIEW_REASONS;
  const title = targetType === "account" ? t("report.accountTitle") : t("report.reviewTitle");

  const reset = () => { setReason(null); setMessage(""); };

  const handleSubmit = async () => {
    if (!user || !reason || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      target_user_id: targetUserId ?? null,
      reason: reason.value,
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toastError(t("report.failed"));
      return;
    }
    hapticSuccess();
    toast.success(t("report.submitted"));
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        {!reason ? (
          <div className="mt-4 space-y-2">
            {reasons.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r)}
                className="w-full text-left px-4 py-3 rounded-lg bg-card border border-border text-sm text-foreground hover:border-primary transition-colors"
              >
                {t(r.label)}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground">
              {t(reason.label)}
            </div>
            <Textarea
              placeholder={t("report.messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              className="min-h-[120px]"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReason(null)} disabled={submitting}>
                {t("back")}
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? t("report.submitting") : t("report.submit")}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
