import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ALL_COUNTRIES, getFlagEmoji } from "@/lib/countryFlags";
import { X, Plus } from "lucide-react";
import { SOCIAL_PLATFORMS, sanitizeSocialLinks, type SocialLinksMap, type SocialPlatform } from "@/lib/socialLinks";

interface ProfileEditSheetProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentData: {
    username: string;
    bio: string | null;
    country: string | null;
    social_links?: SocialLinksMap | null;
  };
}

const parseCountries = (raw: string | null): string[] =>
  raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];

export function ProfileEditSheet({ open, onClose, onSaved, currentData }: ProfileEditSheetProps) {
  const { user } = useAuth();
  const [username, setUsername] = useState(currentData.username);
  const [bio, setBio] = useState(currentData.bio || "");
  const [countries, setCountries] = useState<string[]>(parseCountries(currentData.country));
  const [socialLinks, setSocialLinks] = useState<SocialLinksMap>(
    sanitizeSocialLinks(currentData.social_links ?? {}),
  );
  const [adding, setAdding] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setUsername(currentData.username);
      setBio(currentData.bio || "");
      setCountries(parseCountries(currentData.country));
      setSocialLinks(sanitizeSocialLinks(currentData.social_links ?? {}));
      setAdding(false);
      setCountryQuery("");
    }
  }, [open, currentData]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setShowCountrySuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCountries = countryQuery.trim()
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.toLowerCase().includes(countryQuery.toLowerCase()) &&
          !countries.includes(c),
      ).slice(0, 8)
    : [];

  const handleSelectCountry = (c: string) => {
    if (!countries.includes(c)) setCountries([...countries, c]);
    setCountryQuery("");
    setShowCountrySuggestions(false);
    setAdding(false);
  };

  const handleRemoveCountry = (c: string) => {
    setCountries(countries.filter((x) => x !== c));
  };

  const handleSocialChange = (key: SocialPlatform, value: string) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!user || !username.trim()) return;
    setSaving(true);
    const cleanSocials = sanitizeSocialLinks(socialLinks);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        bio: bio.trim() || null,
        country: countries.length > 0 ? countries.join(", ") : null,
        social_links: cleanSocials,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated");
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="bg-background border-border rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">Edit Profile</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4 pb-6">
          <div>
            <Label className="text-muted-foreground text-xs">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              maxLength={300}
              className="mt-1 resize-none"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/300</p>
          </div>
          <div ref={countryRef} className="relative">
            <Label className="text-muted-foreground text-xs">Countries</Label>

            {/* Selected countries chips */}
            {countries.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {countries.map((c) => (
                  <div
                    key={c}
                    className="inline-flex items-center gap-1.5 bg-card border border-border rounded-full pl-2 pr-1 py-1"
                  >
                    <span className="text-base leading-none">{getFlagEmoji(c)}</span>
                    <span className="text-xs text-foreground">{c}</span>
                    <button
                      onClick={() => handleRemoveCountry(c)}
                      className="w-4 h-4 rounded-full hover:bg-muted/50 flex items-center justify-center"
                      aria-label={`Remove ${c}`}
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {adding ? (
              <div className="relative mt-2">
                <Input
                  autoFocus
                  value={countryQuery}
                  onChange={(e) => {
                    setCountryQuery(e.target.value);
                    setShowCountrySuggestions(true);
                  }}
                  onFocus={() => setShowCountrySuggestions(true)}
                  placeholder="Start typing a country..."
                  maxLength={60}
                />
                {showCountrySuggestions && filteredCountries.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-50 max-h-40 overflow-y-auto">
                    {filteredCountries.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleSelectCountry(c)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                      >
                        <span className="text-base">{getFlagEmoji(c)}</span>
                        <span className="text-sm text-foreground">{c}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {countries.length === 0 ? "Add a country" : "Add more"}
              </button>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving || !username.trim()} className="w-full">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
