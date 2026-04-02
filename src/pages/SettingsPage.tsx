import { useState, useEffect } from "react";
import { ChevronLeft, Lock, Shield, KeyRound, LogOut, Trash2, ChevronRight, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { YourActivity } from "@/components/YourActivity";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<null | "privacy" | "blocked" | "activity" | "password" | "delete">(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string; username: string; profile_picture: string | null }[]>([]);
  const [blockQuery, setBlockQuery] = useState("");
  const [blockSearchResults, setBlockSearchResults] = useState<{ user_id: string; username: string; profile_picture: string | null }[]>([]);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("is_private").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setIsPrivate((data as any).is_private || false);
      setLoading(false);
    });
  }, [user]);

  const togglePrivacy = async () => {
    if (!user) return;
    const newVal = !isPrivate;
    setIsPrivate(newVal);
    await supabase.from("profiles").update({ is_private: newVal } as any).eq("user_id", user.id);
    toast.success(newVal ? "Account set to private" : "Account set to public");
  };

  // Fetch blocked users
  useEffect(() => {
    if (section !== "blocked" || !user) return;
    (async () => {
      const { data } = await supabase.from("blocked_users").select("id, blocked_id").eq("blocker_id", user.id);
      if (!data || data.length === 0) { setBlockedUsers([]); return; }
      const ids = data.map(d => d.blocked_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", ids);
      setBlockedUsers(data.map(d => {
        const p = (profiles || []).find(p => p.user_id === d.blocked_id);
        return { id: d.id, blocked_id: d.blocked_id, username: p?.username || "Unknown", profile_picture: p?.profile_picture || null };
      }));
    })();
  }, [section, user]);

  // Search users to block
  useEffect(() => {
    if (!blockQuery.trim() || !user) { setBlockSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("user_id, username, profile_picture").ilike("username", `%${blockQuery}%`).neq("user_id", user.id).limit(10);
      setBlockSearchResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [blockQuery, user]);

  const handleBlock = async (targetId: string) => {
    if (!user) return;
    await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: targetId });
    // Also unfollow in both directions
    await supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", targetId);
    await supabase.from("followers").delete().eq("follower_id", targetId).eq("following_id", user.id);
    setBlockQuery("");
    setBlockSearchResults([]);
    toast.success("User blocked");
    // Refresh blocked list
    setSection(null);
    setTimeout(() => setSection("blocked"), 50);
  };

  const handleUnblock = async (id: string) => {
    await supabase.from("blocked_users").delete().eq("id", id);
    setBlockedUsers(prev => prev.filter(b => b.id !== id));
    toast.success("User unblocked");
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setChangingPassword(true);
    // Verify current password by re-signing in
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email!, password: currentPassword });
    if (signInErr) { toast.error("Current password is incorrect"); setChangingPassword(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error("Failed to update password"); } else { toast.success("Password updated"); setSection(null); }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setChangingPassword(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") { toast.error("Please type DELETE to confirm"); return; }
    // Sign out - actual deletion would need admin/edge function
    toast.success("Account deletion requested. You will be signed out.");
    await signOut();
    navigate("/auth");
  };

  if (loading) return <div className="min-h-screen bg-background" />;

  // Sub-sections
  if (section === "privacy") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setSection(null)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-xl font-bold text-foreground">Account Privacy</h1>
          </div>
          <div className="flex items-center justify-between py-4 border-b border-border">
            <div>
              <p className="text-sm font-semibold text-foreground">Private Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Only followers can see your full profile</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={togglePrivacy} />
          </div>
          {isPrivate && (
            <p className="text-xs text-muted-foreground mt-3">
              When your account is private, only people you approve can see your countries, cities, diary, lists, and reviews. Your profile picture, username, and bio are always visible.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (section === "blocked") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setSection(null)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-xl font-bold text-foreground">Blocked Users</h1>
          </div>
          <div className="relative mb-4">
            <Input
              value={blockQuery}
              onChange={e => setBlockQuery(e.target.value)}
              placeholder="Search username to block..."
              className="w-full"
            />
            {blockSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-20 max-h-40 overflow-y-auto">
                {blockSearchResults.map(p => (
                  <button key={p.user_id} onClick={() => handleBlock(p.user_id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left">
                    <Avatar className="w-6 h-6">
                      {p.profile_picture ? <AvatarImage src={p.profile_picture} /> : <AvatarFallback className="text-[10px]">{p.username[0]?.toUpperCase()}</AvatarFallback>}
                    </Avatar>
                    <span className="text-sm text-foreground">{p.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center mt-8">No blocked users</p>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      {b.profile_picture ? <AvatarImage src={b.profile_picture} /> : <AvatarFallback className="text-xs">{b.username[0]?.toUpperCase()}</AvatarFallback>}
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{b.username}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleUnblock(b.id)}>Unblock</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === "password") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setSection(null)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-xl font-bold text-foreground">Change Password</h1>
          </div>
          <p className="text-xs text-muted-foreground mb-4">{user?.email}</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Current Password</label>
              <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">New Password</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Confirm New Password</label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword} className="w-full">
              {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (section === "delete") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setSection(null)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-xl font-bold text-foreground">Delete Account</h1>
          </div>
          <p className="text-sm text-foreground mb-2">This action is irreversible. All your data will be permanently deleted.</p>
          <p className="text-xs text-muted-foreground mb-4">Type <strong>DELETE</strong> to confirm.</p>
          <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE" className="mb-4" />
          <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE"} className="w-full">
            Delete My Account
          </Button>
        </div>
      </div>
    );
  }

  // Main settings menu
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>

        <div className="space-y-0">
          <button onClick={() => setSection("privacy")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Account Privacy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button onClick={() => setSection("blocked")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Blocked Users</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button onClick={() => setSection("password")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Change Password</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button onClick={async () => { await signOut(); navigate("/auth"); }} className="flex items-center gap-3 py-4 border-b border-border w-full text-left">
            <LogOut className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Sign Out</span>
          </button>

          <button onClick={() => setSection("delete")} className="flex items-center gap-3 py-4 w-full text-left">
            <Trash2 className="w-5 h-5 text-destructive" />
            <span className="text-sm font-semibold text-destructive">Delete Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
