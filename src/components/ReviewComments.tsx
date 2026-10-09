import { fallbackAvatarUrl } from "@/lib/avatarFallback";
import { profileLinkProps } from "@/lib/profileHeaderQuery";
import { useState, useEffect } from "react";
import { Send, Reply, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { relativeDays } from "@/lib/localeFormat";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { toastError } from "@/lib/toastError";

interface Comment {
  id: string;
  review_id: string;
  user_id: string;
  parent_id: string | null;
  comment_text: string;
  created_at: string;
  profile?: { username: string; profile_picture: string | null };
  replies?: Comment[];
}

// Comments shown before the server has confirmed them.
const PENDING_PREFIX = "pending-";

/** Adds a comment at the end of the thread, or under its parent at any depth. */
function addToTree(tree: Comment[], comment: Comment): Comment[] {
  if (!comment.parent_id) return [...tree, comment];
  return tree.map((c) =>
    c.id === comment.parent_id
      ? { ...c, replies: [...(c.replies ?? []), comment] }
      : { ...c, replies: addToTree(c.replies ?? [], comment) }
  );
}

function removeFromTree(tree: Comment[], id: string): Comment[] {
  return tree
    .filter((c) => c.id !== id)
    .map((c) => ({ ...c, replies: removeFromTree(c.replies ?? [], id) }));
}

export function ReviewComments({ reviewId }: { reviewId: string }) {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [reviewId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("review_comments")
      .select("*")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      setComments([]);
      return;
    }

    const userIds = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, profile_picture")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    // Build tree
    const all: Comment[] = data.map((c) => ({
      ...c,
      profile: profileMap.get(c.user_id) || undefined,
      replies: [],
    }));

    const topLevel: Comment[] = [];
    const byId = new Map(all.map((c) => [c.id, c]));

    all.forEach((c) => {
      if (c.parent_id) {
        const parent = byId.get(c.parent_id);
        if (parent) parent.replies!.push(c);
      } else {
        topLevel.push(c);
      }
    });

    setComments(topLevel);
  };

  // Instant: the comment appears as soon as it's sent, then the list is
  // reloaded from the server. If the save fails it's taken out again and the
  // text is put back in the box (it used to vanish silently).
  const handleSubmit = async () => {
    if (!user || !text.trim() || submitting) return;
    setSubmitting(true);
    const commentText = text.trim();
    const parent = replyTo;
    const pending: Comment = {
      id: `${PENDING_PREFIX}${Date.now()}`,
      review_id: reviewId,
      user_id: user.id,
      parent_id: parent?.id || null,
      comment_text: commentText,
      created_at: new Date().toISOString(),
      profile: profile ? { username: profile.username, profile_picture: profile.profile_picture } : undefined,
      replies: [],
    };
    setComments((prev) => addToTree(prev, pending));
    setText("");
    setReplyTo(null);

    const { error } = await supabase.from("review_comments").insert({
      review_id: reviewId,
      user_id: user.id,
      parent_id: parent?.id || null,
      comment_text: commentText,
    });
    if (error) {
      setComments((prev) => removeFromTree(prev, pending.id));
      setText(commentText);
      setReplyTo(parent);
      toastError(t("comments.postFailed"));
    } else {
      await fetchComments();
    }
    setSubmitting(false);
  };

  // Instant as well: removed on tap, restored if the delete fails.
  const handleDelete = async (commentId: string) => {
    const previous = comments;
    setComments((prev) => removeFromTree(prev, commentId));
    const { error } = await supabase.from("review_comments").delete().eq("id", commentId);
    if (error) {
      setComments(previous);
      toastError(t("comments.deleteFailed"));
      return;
    }
    await fetchComments();
  };

  const formatDate = (dateStr: string) => relativeDays(dateStr, language);

  const renderComment = (comment: Comment, depth: number = 0) => (
    <div key={comment.id} className={`${depth > 0 ? "ml-8 border-l-2 border-border pl-3" : ""}`}>
      <div className="flex items-start gap-2.5 py-2">
        <button onClick={() => navigate(comment.user_id === user?.id ? "/profile" : `/profile/${comment.user_id}`)} {...profileLinkProps(comment.user_id, comment.profile?.username, comment.profile?.profile_picture)}>
          <Avatar className="w-7 h-7">
            <AvatarImage src={comment.profile?.profile_picture || fallbackAvatarUrl(comment.profile?.username || "?")} />
            <AvatarFallback>{comment.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(comment.user_id === user?.id ? "/profile" : `/profile/${comment.user_id}`)} {...profileLinkProps(comment.user_id, comment.profile?.username, comment.profile?.profile_picture)}
              className="text-xs font-semibold text-foreground hover:underline"
            >
              {comment.profile?.username || t("common.user")}
            </button>
            <span className="text-[11px] text-muted-foreground">{formatDate(comment.created_at)}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5" data-no-translate>{comment.comment_text}</p>
          <div className="flex items-center gap-3 mt-1">
            {user && !comment.id.startsWith(PENDING_PREFIX) && (
              <button
                onClick={() => setReplyTo(comment)}
                className="text-[11px] text-primary font-medium flex items-center gap-1"
              >
                <Reply className="w-3 h-3" />
                {t("comments.reply")}
              </button>
            )}
            {user?.id === comment.user_id && !comment.id.startsWith(PENDING_PREFIX) && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-[11px] text-muted-foreground flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      {comment.replies?.map((r) => renderComment(r, depth + 1))}
    </div>
  );

  return (
    <div>
      <h3 className="label-caps mb-3">{t("comments.title")}</h3>

      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground mb-3">{t("comments.none")}</p>
      )}

      <div className="space-y-0.5 mb-4">
        {comments.map((c) => renderComment(c))}
      </div>

      {user && (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            {replyTo && (
              <div className="text-[11px] text-primary mb-1 flex items-center gap-1">
                {t("comments.replyingTo", { username: replyTo.profile?.username ?? "" })}
                <button onClick={() => setReplyTo(null)} className="text-muted-foreground ml-1">✕</button>
              </div>
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={t("comments.placeholder")}
              className="w-full bg-card border border-border rounded-full px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5 text-primary-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
