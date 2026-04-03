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

interface ProfileEditSheetProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentData: {
    username: string;
    bio: string | null;
    country: string | null;
  };
}

export function ProfileEditSheet({ open, onClose, onSaved, currentData }: ProfileEditSheetProps) {
  const { user } = useAuth();
  const [username, setUsername] = useState(currentData.username);
  const [bio, setBio] = useState(currentData.bio || "");
  const [country, setCountry] = useState(currentData.country || "");
  const [countryQuery, setCountryQuery] = useState(currentData.country || "");
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setUsername(currentData.username);
      setBio(currentData.bio || "");
      setCountry(currentData.country || "");
      setCountryQuery(currentData.country || "");
    }
  }, [open, currentData]);

  // Close suggestions on outside click
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
    ? ALL_COUNTRIES.filter(c => c.toLowerCase().includes(countryQuery.toLowerCase())).slice(0, 8)
    : [];

  const handleSelectCountry = (c: string) => {
    setCountry(c);
    setCountryQuery(c);
    setShowCountrySuggestions(false);
  };

  const handleClearCountry = () => {
    setCountry("");
    setCountryQuery("");
  };

  const handleSave = async () => {
    if (!user || !username.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        bio: bio.trim() || null,
        country: country.trim() || null,
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
            <Label className="text-muted-foreground text-xs">Country</Label>
            <div className="relative mt-1">
              <Input
                value={countryQuery}
                onChange={(e) => {
                  setCountryQuery(e.target.value);
                  setCountry("");
                  setShowCountrySuggestions(true);
                }}
                onFocus={() => setShowCountrySuggestions(true)}
                placeholder="Start typing a country..."
                maxLength={60}
              />
              {country && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-base">{getFlagEmoji(country)}</span>
                  <button onClick={handleClearCountry} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
              )}
            </div>
            {showCountrySuggestions && filteredCountries.length > 0 && !country && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-50 max-h-40 overflow-y-auto">
                {filteredCountries.map(c => (
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
          <Button onClick={handleSave} disabled={saving || !username.trim()} className="w-full">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
