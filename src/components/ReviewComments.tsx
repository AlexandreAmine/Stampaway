import { useState, useEffect } from "react";
import { Send, Reply, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

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

export function ReviewComments({ reviewId }: { reviewId: string }) {
  const { user } = useAuth();
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

  const handleSubmit = async () => {
    if (!user || !text.trim() || submitting) return;
    setSubmitting(true);

    await supabase.from("review_comments").insert({
      review_id: reviewId,
      user_id: user.id,
      parent_id: replyTo?.id || null,
      comment_text: text.trim(),
    });

    setText("");
    setReplyTo(null);
    await fetchComments();
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from("review_comments").delete().eq("id", commentId);
    await fetchComments();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const renderComment = (comment: Comment, depth: number = 0) => (
    <div key={comment.id} className={`${depth > 0 ? "ml-8 border-l-2 border-border pl-3" : ""}`}>
      <div className="flex items-start gap-2.5 py-2">
        <button onClick={() => navigate(comment.user_id === user?.id ? "/profile" : `/profile/${comment.user_id}`)}>
          <Avatar className="w-7 h-7">
            <AvatarImage src={comment.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.profile?.username || "?")}&background=3B82F6&color=fff`} />
            <AvatarFallback>{comment.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(comment.user_id === user?.id ? "/profile" : `/profile/${comment.user_id}`)}
              className="text-xs font-semibold text-foreground hover:underline"
            >
              {comment.profile?.username || "User"}
            </button>
            <span className="text-[10px] text-muted-foreground">{formatDate(comment.created_at)}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5" data-no-translate>{comment.comment_text}</p>
          <div className="flex items-center gap-3 mt-1">
            {user && (
              <button
                onClick={() => setReplyTo(comment)}
                className="text-[10px] text-primary font-medium flex items-center gap-1"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>
            )}
            {user?.id === comment.user_id && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-[10px] text-muted-foreground flex items-center gap-1"
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
      <h3 className="text-sm font-semibold text-foreground mb-3">Comments</h3>

      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground mb-3">No comments yet</p>
      )}

      <div className="space-y-0.5 mb-4">
        {comments.map((c) => renderComment(c))}
      </div>

      {user && (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            {replyTo && (
              <div className="text-[10px] text-primary mb-1 flex items-center gap-1">
                Replying to {replyTo.profile?.username}
                <button onClick={() => setReplyTo(null)} className="text-muted-foreground ml-1">✕</button>
              </div>
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Add a comment..."
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
