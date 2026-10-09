import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  /** One useful next step. Leave out when there's nothing to do. */
  action?: { label: string; onClick: () => void };
  /** A quieter alternative, shown as a text button under the main one. */
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * The app's one empty-state design: an icon, a short title, one line, and
 * at most one button. An invitation to act rather than a grey sentence.
 */
export function EmptyState({ icon: Icon, title, body, action, secondaryAction, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}>
      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
        <Icon className="w-6 h-6 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {body && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className={buttonVariants({ size: "sm", className: "mt-4" })}>
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button type="button" onClick={secondaryAction.onClick} className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-1" })}>
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
