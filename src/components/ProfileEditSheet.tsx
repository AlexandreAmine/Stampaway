import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername(currentData.username);
      setBio(currentData.bio || "");
      setCountry(currentData.country || "");
    }
  }, [open, currentData]);

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
          <div>
            <Label className="text-muted-foreground text-xs">Country</Label>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. France"
              maxLength={60}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !username.trim()} className="w-full">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
