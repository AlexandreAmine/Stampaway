import { useMemo, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  Share2,
  MessageCircle,
  Mail,
  Twitter,
  Facebook,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNativeFeatures } from "@/hooks/useNativeFeatures";
import { getFlagEmoji } from "@/lib/countryFlags";

interface ShareProfileSheetProps {
  open: boolean;
  onClose: () => void;
  profile: {
    userId: string;
    username: string;
    profile_picture: string | null;
    bio?: string | null;
    country?: string | null;
  };
  stats?: {
    countries: number;
    cities: number;
    followers: number;
  };
}

export function ShareProfileSheet({ open, onClose, profile, stats }: ShareProfileSheetProps) {
  const { t } = useLanguage();
  const { share } = useNativeFeatures();
  const [copied, setCopied] = useState(false);

  const profileUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/profile/${profile.userId}`;
  }, [profile.userId]);

  const shareText = `${t("share.checkOut")} @${profile.username} ${t("share.onStampaway")}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success(t("share.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("share.copyFailed"));
    }
  };

  const handleNativeShare = async () => {
    const result = await share({
      title: `@${profile.username} • Stampaway`,
      text: shareText,
      url: profileUrl,
    });
    if (!result.ok) {
      handleCopy();
    }
  };

  const encodedUrl = encodeURIComponent(profileUrl);
  const encodedText = encodeURIComponent(shareText);

  const channels: { key: string; label: string; icon: any; bg: string; href: string }[] = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      bg: "bg-[#25D366]",
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: Send,
      bg: "bg-[#229ED9]",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      key: "twitter",
      label: "X",
      icon: Twitter,
      bg: "bg-black",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: Facebook,
      bg: "bg-[#1877F2]",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      bg: "bg-muted",
      href: `mailto:?subject=${encodeURIComponent(`@${profile.username} on Stampaway`)}&body=${encodedText}%20${encodedUrl}`,
    },
  ];

  const initials = profile.username.slice(0, 2).toUpperCase();
  const firstCountry = profile.country?.split(",")[0]?.trim();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-background border-border rounded-t-2xl max-h-[92vh] overflow-y-auto p-0"
      >
        <div className="px-5 pt-4 pb-6">
          {/* Drag handle */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />

          <h2 className="text-center text-base font-semibold text-foreground mb-5">
            {t("share.shareProfile")}
          </h2>

          {/* Profile card with QR */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 mb-5">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col items-center text-center">
              <Avatar className="w-20 h-20 border-2 border-background shadow-lg">
                <AvatarImage src={profile.profile_picture || undefined} alt={profile.username} />
                <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="text-base font-semibold text-foreground" data-no-translate>@{profile.username}</span>
                {firstCountry && (
                  <span className="text-base leading-none">{getFlagEmoji(firstCountry)}</span>
                )}
              </div>
              {profile.bio && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 max-w-[260px]" data-no-translate>
                  {profile.bio}
                </p>
              )}

              {stats && (
                <div className="mt-4 flex items-center gap-6">
                  <Stat value={stats.countries} label={t("profile.countries")} />
                  <Divider />
                  <Stat value={stats.cities} label={t("profile.cities")} />
                  <Divider />
                  <Stat value={stats.followers} label={t("profile.followers")} />
                </div>
              )}

              <div className="mt-5 rounded-2xl bg-white p-3 shadow-md">
                <QRCodeSVG
                  value={profileUrl}
                  size={140}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t("share.scanToView")}
              </p>
            </div>
          </div>

          {/* Copy link row */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-card pl-4 pr-1 py-1 mb-5">
            <span className="flex-1 truncate text-xs text-muted-foreground">{profileUrl}</span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium active:opacity-80"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t("share.copied") : t("share.copy")}
            </button>
          </div>

          {/* Channels */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            <ChannelButton
              label={t("share.more")}
              icon={Share2}
              bg="bg-card border border-border"
              iconClass="text-foreground"
              onClick={handleNativeShare}
            />
            {channels.map((c) => {
              const Icon = c.icon;
              return (
                <a
                  key={c.key}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 active:opacity-70"
                >
                  <div className={`w-12 h-12 rounded-full ${c.bg} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{c.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-sm font-bold text-foreground leading-tight">{value}</span>
      <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-6 w-px bg-border" />;
}

function ChannelButton({
  label,
  icon: Icon,
  bg,
  iconClass = "text-white",
  onClick,
}: {
  label: string;
  icon: any;
  bg: string;
  iconClass?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:opacity-70">
      <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${iconClass}`} />
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}
