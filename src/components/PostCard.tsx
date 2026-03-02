import { useState } from "react";
import { Hash, Heart, MessageSquare, Repeat2, Share, Bookmark, MoreHorizontal, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { PostWithProfile } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { useNavigate, Link } from "react-router-dom";

interface PostCardProps {
  post: PostWithProfile;
  onLike: (postId: string, liked: boolean) => void;
  onBookmark: (postId: string, bookmarked: boolean) => void;
  onDelete?: (postId: string) => void;
}

function getTimeRemaining(dateStr: string): string {
  const created = new Date(dateStr);
  const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

const PostCard = ({ post, onLike, onBookmark, onDelete }: PostCardProps) => {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();

  const initials = post.profiles?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

  const isOwner = user?.id === post.user_id;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="gum-card p-5 mb-4"
    >
      <div className="flex gap-3">
        <button
          onClick={() => navigate(`/${post.profiles?.username}`)}
          className="w-10 h-10 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden hover:opacity-80 transition-opacity"
        >
          {post.profiles?.avatar_url ? (
            <img src={post.profiles.avatar_url} alt={post.profiles.username} className="w-full h-full object-cover" />
          ) : initials}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/${post.profiles?.username}`)}
              className="flex items-center gap-2 group text-left"
            >
              <span className="font-bold text-sm group-hover:underline">{post.profiles?.display_name || "Unknown"}</span>
              <span className="text-muted-foreground text-sm">@{post.profiles?.username || "?"}</span>
              <span className="text-muted-foreground text-xs">· {timeAgo(post.created_at)}</span>
              <span className="text-primary/70 text-[10px] font-bold ml-2">[{getTimeRemaining(post.created_at)}]</span>
            </button>
            {isOwner && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded-lg hover:bg-secondary transition-colors"
                >
                  <MoreHorizontal size={16} className="text-muted-foreground" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 gum-card p-1 z-10 min-w-[120px]">
                    <button
                      onClick={() => { onDelete?.(post.id); setShowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

          {post.media_url && (
            <div className="mt-3 rounded-lg gum-border overflow-hidden bg-muted">
              <img
                src={post.media_url}
                alt="Post content"
                className="w-full h-auto max-h-[500px] object-contain mx-auto"
                loading="lazy"
              />
            </div>
          )}

          {post.code && (
            <div className="mt-3 gum-border rounded-lg bg-muted p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-foreground">
                <code>{post.code}</code>
              </pre>
            </div>
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs font-mono font-medium bg-secondary px-2.5 py-1 rounded-lg gum-border gum-shadow-sm"
                >
                  <Hash size={10} />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-6 mt-4 pt-3 border-t border-secondary">
            <button
              onClick={() => onLike(post.id, post.user_liked)}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${post.user_liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                }`}
            >
              <Heart size={15} fill={post.user_liked ? "currentColor" : "none"} className={post.user_liked ? "text-red-500" : ""} />
              {post.likes_count}
            </button>
            <Link
              to={`/post/${post.id}`}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageSquare size={15} />
              {post.comments_count}
            </Link>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin + "/post/" + post.id);
                toast.success("Link copied to clipboard!");
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Share size={15} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default PostCard;
