import { useState } from "react";
import { MoreHorizontal, Flag, Ban, ShieldOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportSheet } from "@/components/ReportSheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  targetUserId: string;
  isBlocked: boolean;
  onBlockChange?: (blocked: boolean) => void;
}

export function ProfileActionsMenu({ targetUserId, isBlocked, onBlockChange }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const handleBlock = async () => {
    if (!user) return;
    // Remove mutual follows
    const followResults = await Promise.all([
      supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", targetUserId),
      supabase.from("followers").delete().eq("follower_id", targetUserId).eq("following_id", user.id),
      supabase.from("follow_requests").delete().eq("requester_id", user.id).eq("target_id", targetUserId),
      supabase.from("follow_requests").delete().eq("requester_id", targetUserId).eq("target_id", user.id),
    ]);
    if (followResults.some((result) => !result.error)) invalidateOwnProfileContentCache(user.id);
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: targetUserId });
    if (error) { toast.error(t("block.failed")); return; }
    toast.success(t("toast.userBlocked"));
    onBlockChange?.(true);
    setConfirmBlock(false);
  };

  const handleUnblock = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId);
    if (error) { toast.error(t("block.unblockFailed")); return; }
    toast.success(t("toast.userUnblocked"));
    onBlockChange?.(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-2 rounded-full" aria-label={t("common.moreOptions")}>
            <MoreHorizontal className="w-5 h-5 text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setReportOpen(true)}>
            <Flag className="w-4 h-4 mr-2" />
            {t("report.action")}
          </DropdownMenuItem>
          {isBlocked ? (
            <DropdownMenuItem onSelect={handleUnblock}>
              <ShieldOff className="w-4 h-4 mr-2" />
              {t("settings.unblock")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirmBlock(true)} className="text-destructive focus:text-destructive">
              <Ban className="w-4 h-4 mr-2" />
              {t("block.action")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportSheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="account"
        targetId={targetUserId}
        targetUserId={targetUserId}
      />

      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("block.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("block.confirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlock}>{t("block.action")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
