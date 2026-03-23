import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getFlagEmoji } from "@/lib/countryFlags";
import { toast } from "sonner";

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","São Tomé and Príncipe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentData: {
    username: string;
    bio: string | null;
    country: string | null;
  };
  onSaved: () => void;
}

export function EditProfileDialog({ open, onClose, userId, currentData, onSaved }: EditProfileDialogProps) {
  const [username, setUsername] = useState(currentData.username);
  const [bio, setBio] = useState(currentData.bio || "");
  const [country, setCountry] = useState(currentData.country || "");
  const [saving, setSaving] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  useEffect(() => {
    setUsername(currentData.username);
    setBio(currentData.bio || "");
    setCountry(currentData.country || "");
  }, [currentData]);

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      username: username.trim(),
      bio: bio.trim() || null,
      country: country || null,
    }).eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated!");
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} className="mt-1" />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="Write a short bio..." className="mt-1 resize-none" rows={3} />
            <p className="text-xs text-muted-foreground mt-1">{bio.length}/160</p>
          </div>
          <div className="relative">
            <Label className="text-muted-foreground text-xs">Country</Label>
            <div className="flex items-center gap-2 mt-1">
              {country && <span className="text-lg">{getFlagEmoji(country)}</span>}
              <Input
                value={showCountryDropdown ? countrySearch : country}
                onChange={(e) => { setCountrySearch(e.target.value); setShowCountryDropdown(true); }}
                onFocus={() => { setCountrySearch(""); setShowCountryDropdown(true); }}
                onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
                placeholder="Select your country"
                className="flex-1"
              />
            </div>
            {showCountryDropdown && (
              <div className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto bg-card border border-border rounded-md shadow-lg">
                {filteredCountries.map((c) => (
                  <button
                    key={c}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setCountry(c); setShowCountryDropdown(false); setCountrySearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <span>{getFlagEmoji(c)}</span> {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
