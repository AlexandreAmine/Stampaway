import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ACCOUNT_REASONS = [
  "Account exhibits a pattern of posting unwelcome, aggressive or abusive remarks directed at another member",
  "Account exhibits a pattern of posting racist, sexist, homophobic or other discriminatory views (including white nationalist ideologies)",
  "Account exhibits a pattern of plagiarism (please include link/s to original content)",
  "Account promotes piracy or other illegal activity",
  "Account is attempting to manipulate destination ratings or popularity (by following an excessive number of accounts)",
  "Account is posting unsolicited links to content, products or services, including for self-promotion",
  "Account is an impersonation, satire or parody",
  "Account has attempted to solicit personal information from a member (please include a relevant link)",
  "Account has an offensive username or bio",
  "Other",
];

const REVIEW_REASONS = [
  "Contains abuse",
  "Contains violent words",
  "Contains plagiarism",
  "Contains spam",
  "Other reason",
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
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reasons = targetType === "account" ? ACCOUNT_REASONS : REVIEW_REASONS;
  const title = targetType === "account" ? "Report account" : "Report review";

  const reset = () => { setReason(null); setMessage(""); };

  const handleSubmit = async () => {
    if (!user || !reason || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      target_user_id: targetUserId ?? null,
      reason,
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not submit report");
      return;
    }
    toast.success("Report submitted. Thank you.");
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
                key={r}
                onClick={() => setReason(r)}
                className="w-full text-left px-4 py-3 rounded-lg bg-card border border-border text-sm text-foreground hover:border-primary transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground">
              {reason}
            </div>
            <Textarea
              placeholder="Add an optional message with more details..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              className="min-h-[120px]"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReason(null)} disabled={submitting}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit report"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
