import { Instagram, Youtube, Facebook, Music2, Twitter } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SocialPlatform = "instagram" | "youtube" | "x" | "facebook" | "tiktok";

export interface SocialPlatformConfig {
  key: SocialPlatform;
  label: string;
  icon: LucideIcon;
  domain: string;
  placeholder: string;
  buildUrl: (handle: string) => string;
}

const stripHandle = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Strip leading @ and any URL portion
  let h = trimmed.replace(/^@+/, "");
  // If full URL pasted, take last path segment
  const urlMatch = h.match(/^https?:\/\/[^/]+\/(.+?)\/?$/i);
  if (urlMatch) h = urlMatch[1];
  return h.split("/")[0].split("?")[0];
};

export const SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    domain: "instagram.com",
    placeholder: "username",
    buildUrl: (h) => `https://instagram.com/${stripHandle(h)}`,
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: Youtube,
    domain: "youtube.com",
    placeholder: "@channel",
    buildUrl: (h) => {
      const handle = stripHandle(h);
      return `https://youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}`;
    },
  },
  {
    key: "x",
    label: "X",
    icon: Twitter,
    domain: "x.com",
    placeholder: "username",
    buildUrl: (h) => `https://x.com/${stripHandle(h)}`,
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: Facebook,
    domain: "facebook.com",
    placeholder: "username",
    buildUrl: (h) => `https://facebook.com/${stripHandle(h)}`,
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: Music2,
    domain: "tiktok.com",
    placeholder: "@username",
    buildUrl: (h) => {
      const handle = stripHandle(h);
      return `https://tiktok.com/${handle.startsWith("@") ? handle : `@${handle}`}`;
    },
  },
];

export const getPlatformConfig = (key: SocialPlatform): SocialPlatformConfig | undefined =>
  SOCIAL_PLATFORMS.find((p) => p.key === key);

export const formatHandle = (key: SocialPlatform, raw: string): string => {
  const handle = stripHandle(raw);
  if (!handle) return "";
  if (key === "tiktok" || key === "youtube") {
    return handle.startsWith("@") ? handle : `@${handle}`;
  }
  return `@${handle}`;
};

export type SocialLinksMap = Partial<Record<SocialPlatform, string>>;

export const sanitizeSocialLinks = (raw: unknown): SocialLinksMap => {
  if (!raw || typeof raw !== "object") return {};
  const out: SocialLinksMap = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = (raw as Record<string, unknown>)[p.key];
    if (typeof v === "string") {
      const cleaned = stripHandle(v);
      if (cleaned) out[p.key] = cleaned;
    }
  }
  return out;
};
