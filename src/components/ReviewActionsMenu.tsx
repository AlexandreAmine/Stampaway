import { useState } from "react";
import { MoreHorizontal, Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportSheet } from "@/components/ReportSheet";

interface Props {
  reviewId: string;
  reviewUserId: string;
  className?: string;
}

export function ReviewActionsMenu({ reviewId, reviewUserId, className }: Props) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={
              className ??
              "w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
            }
            aria-label="More options"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-5 h-5 text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setReportOpen(true)}>
            <Flag className="w-4 h-4 mr-2" />
            Report this review
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportSheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="review"
        targetId={reviewId}
        targetUserId={reviewUserId}
      />
    </>
  );
}
