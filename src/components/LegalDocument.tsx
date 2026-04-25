import { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LegalDocumentProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Shared layout for the Privacy Policy and Terms of Service pages.
 * Matches the look of the rest of the Settings sub-pages (back chevron,
 * top padding, dark theme) and gives long-form legal text a comfortable
 * reading width and typography.
 */
export function LegalDocument({ title, lastUpdated, children }: LegalDocumentProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="p-1 -ml-1"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </div>

        <p className="text-xs text-muted-foreground mb-8">
          Last updated: {lastUpdated}
        </p>

        <article
          className="
            prose prose-invert max-w-none
            prose-headings:text-foreground prose-headings:font-semibold
            prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-sm prose-p:text-foreground/90 prose-p:leading-relaxed
            prose-li:text-sm prose-li:text-foreground/90 prose-li:leading-relaxed
            prose-strong:text-foreground
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-ul:my-3 prose-ol:my-3
          "
        >
          {children}
        </article>
      </div>
    </div>
  );
}
