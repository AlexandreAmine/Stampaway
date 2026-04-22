import { useState, useEffect } from "react";
import { ChevronLeft, Lock, Shield, KeyRound, LogOut, Trash2, ChevronRight, Activity, Globe, User } from "lucide-react";
import { PasswordAndAuthSection } from "@/components/PasswordAndAuthSection";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { languageNames, Language } from "@/i18n/translations";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { YourActivity } from "@/components/YourActivity";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<null | "privacy" | "blocked" | "activity" | "language" | "password" | "delete" | "personal">(null);

  // Personal details state
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalDob, setPersonalDob] = useState("");
  const [personalUsername, setPersonalUsername] = useState("");


  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string; username: string; profile_picture: string | null }[]>([]);
  const [blockQuery, setBlockQuery] = useState("");
  const [blockSearchResults, setBlockSearchResults] = useState<{ user_id: string; username: string; profile_picture: string | null }[]>([]);
  const [pendingBlock, setPendingBlock] = useState<{ user_id: string; username: string } | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("is_private, email, date_of_birth, username").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setIsPrivate((data as any).is_private || false);
        setPersonalEmail((data as any).email || "");
        setPersonalDob((data as any).date_of_birth || "");
        setPersonalUsername((data as any).username || "");
      }
      setLoading(false);
    });
  }, [user]);

  const togglePrivacy = async () => {
    if (!user) return;
    const newVal = !isPrivate;
    setIsPrivate(newVal);
    await supabase.from("profiles").update({ is_private: newVal } as any).eq("user_id", user.id);
    toast.success(newVal ? t("toast.accountPrivate") : t("toast.accountPublic"));
  };

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

  useEffect(() => {
    if (!blockQuery.trim() || !user) { setBlockSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("user_id, username, profile_picture").ilike("username", `%${blockQuery}%`).neq("user_id", user.id).limit(10);
      setBlockSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [blockQuery, user]);

  const handleBlock = async (targetId: string, username: string) => {
    if (!user) return;
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: targetId });
    if (error) {
      toast.error("Failed to block user");
      return;
    }
    await supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", targetId);
    await supabase.from("followers").delete().eq("follower_id", targetId).eq("following_id", user.id);
    setBlockQuery("");
    setBlockSearchResults([]);
    const { data: profile } = await supabase.from("profiles").select("user_id, username, profile_picture").eq("user_id", targetId).maybeSingle();
    const { data: row } = await supabase.from("blocked_users").select("id").eq("blocker_id", user.id).eq("blocked_id", targetId).maybeSingle();
    if (row) {
      setBlockedUsers(prev => [
        ...prev.filter(b => b.blocked_id !== targetId),
        { id: row.id, blocked_id: targetId, username: profile?.username || username, profile_picture: profile?.profile_picture || null },
      ]);
    }
    toast.success(t("toast.userBlocked"));
  };

  const handleUnblock = async (id: string) => {
    await supabase.from("blocked_users").delete().eq("id", id);
    setBlockedUsers(prev => prev.filter(b => b.id !== id));
    toast.success(t("toast.userUnblocked"));
  };


  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") { toast.error(t("toast.typeDelete")); return; }
    toast.success(t("toast.accountDeleted"));
    await signOut();
    navigate("/auth");
  };

  if (loading) return <div className="min-h-screen bg-background" />;

  if (section === "personal") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setSection(null)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-xl font-bold text-foreground">{t("settings.personalDetails")}</h1>
          </div>
          <div className="space-y-5">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("auth.username")}</label>
              <p className="text-sm text-foreground bg-card rounded-xl py-3 px-4 border border-border">{personalUsername}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("auth.email")}</label>
              <p className="text-sm text-foreground bg-card rounded-xl py-3 px-4 border border-border">
                {personalEmail || user?.email || t("settings.notSet")}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.dateOfBirth")}</label>
              <p className="text-sm text-foreground bg-card rounded-xl py-3 px-4 border border-border">
                {personalDob ? new Date(personalDob).toLocaleDateString() : t("settings.notSet")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === "activity") {
    return <YourActivity onBack={() => setSection(null)} />;
  }

  if (section === "language") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setSection(null)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-xl font-bold text-foreground">{t("settings.language")}</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">{t("settings.selectLanguage")}</p>
          <div className="space-y-1">
            {(Object.keys(languageNames) as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`w-full flex items-center justify-between py-3.5 px-4 rounded-xl text-left transition-colors ${
                  language === lang ? "bg-primary/10 border border-primary" : "hover:bg-muted/50"
                }`}
              >
                <span className={`text-sm font-medium ${language === lang ? "text-primary" : "text-foreground"}`}>
                  {languageNames[lang]}
                </span>
                {language === lang && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-xs">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (section === "privacy") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setSection(null)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-xl font-bold text-foreground">{t("settings.accountPrivacy")}</h1>
          </div>
          <div className="flex items-center justify-between py-4 border-b border-border">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("settings.privateAccount")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.privateDesc")}</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={togglePrivacy} />
          </div>
          {isPrivate && (
            <p className="text-xs text-muted-foreground mt-3">{t("settings.privateInfo")}</p>
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
            <h1 className="text-xl font-bold text-foreground">{t("settings.blockedUsers")}</h1>
          </div>
          <div className="relative mb-4">
            <Input value={blockQuery} onChange={e => setBlockQuery(e.target.value)} placeholder={t("settings.searchToBlock")} className="w-full" />
            {blockSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-20 max-h-40 overflow-y-auto">
                {blockSearchResults.map(p => (
                  <button key={p.user_id} onClick={() => setPendingBlock({ user_id: p.user_id, username: p.username })} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left">
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
            <p className="text-sm text-muted-foreground text-center mt-8">{t("settings.noBlocked")}</p>
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
                  <Button variant="outline" size="sm" onClick={() => handleUnblock(b.id)}>{t("settings.unblock")}</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === "password") {
    return <PasswordAndAuthSection user={user} t={t} onBack={() => setSection(null)} />;
  }

  if (section === "delete") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setSection(null)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-xl font-bold text-foreground">{t("settings.deleteAccount")}</h1>
          </div>
          <p className="text-sm text-foreground mb-2">{t("settings.deleteWarning")}</p>
          <p className="text-xs text-muted-foreground mb-4">{t("settings.typeDelete")}</p>
          <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE" className="mb-4" />
          <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE"} className="w-full">
            {t("settings.deleteMyAccount")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="text-xl font-bold text-foreground">{t("settings.title")}</h1>
        </div>

        <div className="space-y-0">
          <button onClick={() => setSection("personal")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{t("settings.personalDetails")}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button onClick={() => setSection("privacy")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{t("settings.accountPrivacy")}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button onClick={() => setSection("blocked")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{t("settings.blockedUsers")}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button onClick={() => setSection("activity")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{t("settings.yourActivity")}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button onClick={() => setSection("language")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{t("settings.language")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{languageNames[language]}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>

          <button onClick={() => setSection("password")} className="flex items-center justify-between py-4 border-b border-border w-full text-left">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{t("settings.changePassword")}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button onClick={() => setSignOutOpen(true)} className="flex items-center gap-3 py-4 border-b border-border w-full text-left">
            <LogOut className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{t("settings.signOut")}</span>
          </button>

          <button onClick={() => setSection("delete")} className="flex items-center gap-3 py-4 w-full text-left">
            <Trash2 className="w-5 h-5 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{t("settings.deleteAccount")}</span>
          </button>
        </div>
      </div>

      {/* Sign-out confirmation */}
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.signOut")}</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to sign out?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { await signOut(); navigate("/auth"); }}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block confirmation */}
      <AlertDialog open={!!pendingBlock} onOpenChange={(v) => !v && setPendingBlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {pendingBlock?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to find your profile, posts or activity. They won't be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (pendingBlock) await handleBlock(pendingBlock.user_id);
                setPendingBlock(null);
              }}
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
