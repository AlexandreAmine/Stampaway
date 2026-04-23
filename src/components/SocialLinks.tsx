import { SOCIAL_PLATFORMS, formatHandle, type SocialLinksMap } from "@/lib/socialLinks";

interface SocialLinksProps {
  links: SocialLinksMap;
}

export function SocialLinks({ links }: SocialLinksProps) {
  const entries = SOCIAL_PLATFORMS.filter((p) => links[p.key]);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {entries.map((p) => {
        const handle = links[p.key]!;
        const Icon = p.icon;
        return (
          <a
            key={p.key}
            href={p.buildUrl(handle)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border text-xs text-foreground hover:border-primary transition-colors"
            aria-label={`${p.label}: ${handle}`}
          >
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{formatHandle(p.key, handle)}</span>
          </a>
        );
      })}
    </div>
  );
}
