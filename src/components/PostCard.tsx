import { useState, useEffect, useRef, memo, useMemo } from "react";
import { Hash, Heart, MessageSquare, Share, Bookmark, MoreHorizontal, Trash2, Send, Languages, Eye, Pencil } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
import { PostWithProfile } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { usePostViews } from "@/hooks/usePostViews";
import { toast } from "sonner";

import { useNavigate, Link } from "react-router-dom";
import { getNow } from "@/lib/utils";
import { getConfig } from "@/lib/config";
import { linkify } from "@/lib/linkify";
import { shareWithFallback } from "@/lib/nativeShare";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkGemoji from "remark-gemoji";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { useTheme } from "@/components/theme-provider";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import EditPostDialog from "@/components/EditPostDialog";

interface PostCardProps {
  post: PostWithProfile;
  onLike: (postId: string, liked: boolean) => void;
  onBookmark: (postId: string, bookmarked: boolean) => void;
  onDelete?: (postId: string) => void;
  onPostEdited?: (postId: string, updated: {
    content: string;
    code: string;
    code_language: string | null;
    media_url: string | null;
    is_readme: boolean;
    tags: string[];
    edited_at: string | null;
  }) => void;
}

function getTimeRemaining(dateStr: string): string {
  const created = new Date(dateStr);
  const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000);
  const now = getNow();
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
  const diff = getNow().getTime() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

const PostCard = memo(({ post, onLike, onBookmark, onDelete, onPostEdited }: PostCardProps) => {
  const { user } = useAuth();
  const { recordView } = usePostViews();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const [viewCount, setViewCount] = useState<number>(post.views_count || 0);

  // Translation States
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isShowingTranslation, setIsShowingTranslation] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const initials = post.profiles?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

  const { theme } = useTheme();
  const currentTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  const highlighterTheme = currentTheme === "dark" ? vscDarkPlus : oneLight;

  const isOwner = user?.id === post.user_id;

  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [likeBurstId, setLikeBurstId] = useState(0);
  const likeAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (likeAnimationTimeoutRef.current !== null) {
        window.clearTimeout(likeAnimationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setViewCount(Number(post.views_count || 0));
  }, [post.id, post.views_count]);

  useEffect(() => {
    const node = articleRef.current;
    if (!node) return;

    let observer: IntersectionObserver | null = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
        if (!hit) return;

        void recordView(post.id, "impression").then((count) => {
          if (typeof count === "number") {
            setViewCount((prev) => Math.max(prev, count));
          }
        });

        observer?.disconnect();
        observer = null;
      },
      { threshold: [0.5] },
    );

    observer.observe(node);

    return () => {
      observer?.disconnect();
    };
  }, [post.id, recordView]);

  // Content Selection Logic
  const isAlreadyEnglish = useMemo(() => {
    const text = post.content.trim();
    if (!text) return true;
    
    // If it contains characters from non-Latin scripts (Cyrillic, Arabic, CJK, Bengali, Hindi, Thai, Hebrew, Greek, etc), it's definitely not English
    // eslint-disable-next-line no-misleading-character-class
    const hasOtherScripts = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0980-\u09FF\u0900-\u097F\u0E00-\u0E7F\u0370-\u03FF\u0590-\u05FF\u0B80-\u0BFF\u0A80-\u0AFF\u0C00-\u0C7F]/.test(text);
    if (hasOtherScripts) return false;
    
    // Check for common English words (most effective heuristic for Latin-script text)
    const commonEnglishWords = /\b(the|and|is|it|you|that|in|was|for|on|are|with|as|I|be|at|have|from|this|but|his|by|they|we|say|her|she|or|an|will|my|one|all|would|there|their|what|so|up|out|if|about|who|get|which|go|me)\b/i;
    
    // It's English if it has English words or it's very short and only ASCII
    // eslint-disable-next-line no-control-regex
    return commonEnglishWords.test(text) || (text.length < 30 && !/[^\x00-\x7F]/.test(text));
  }, [post.content]);

  const rawContent = isShowingTranslation && translatedContent ? translatedContent : post.content;
  const isLongPost = rawContent.length > 300;
  const displayContent = isLongPost && !isTextExpanded ? rawContent.slice(0, 300) + '…' : rawContent;

  const codeLines = post.code?.split('\n') || [];
  const isLongCode = codeLines.length > 10;
  const truncatedCode = isLongCode ? codeLines.slice(0, 10).join('\n') + '\n…' : post.code;

  // Translation Logic
  const handleTranslate = async () => {
    if (isShowingTranslation) {
      setIsShowingTranslation(false);
      return;
    }

    if (translatedContent) {
      setIsShowingTranslation(true);
      return;
    }

    // If it's already English, don't perform translation
    if (isAlreadyEnglish) {
      toast.info("This post is already in English.");
      return;
    }

    try {
      setIsTranslating(true);
      // Replace with your actual local server URL
      const apiUrl = getConfig().VITE_LANG_SERVICE;
      const response = await fetch(`${apiUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: post.content, target: 'en' })
      });

      if (!response.ok) throw new Error();

      const data = await response.json();
      setTranslatedContent(data.translatedText);
      setIsShowingTranslation(true);
      toast.success("Translated to English");
    } catch (error) {
      toast.error("Could not translate post.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleLikeClick = () => {
    const willLike = !post.user_liked;
    onLike(post.id, post.user_liked);

    if (!willLike) return;

    setLikeBurstId((id) => id + 1);
    setIsLikeAnimating(true);

    if (likeAnimationTimeoutRef.current !== null) {
      window.clearTimeout(likeAnimationTimeoutRef.current);
    }

    likeAnimationTimeoutRef.current = window.setTimeout(() => {
      setIsLikeAnimating(false);
    }, 520);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    const title = `${post.profiles?.display_name || "Someone"} on genjutsu`;
    const baseText = post.content?.trim() || "Check out this post on genjutsu.";
    const text = baseText.length > 140 ? `${baseText.slice(0, 137)}...` : baseText;

    const result = await shareWithFallback({ title, text, url });
    if (result === "copied") {
      toast.success("Link copied to clipboard!");
    } else if (result === "failed") {
      toast.error("Couldn't share this post right now.");
    }
  };


  return (
    <motion.article
      ref={articleRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="gum-card p-5 mb-4"
    >
      <div className="flex gap-3">
        <button
          onClick={() => navigate(`/u/${post.profiles?.username}`)}
          className="w-10 h-10 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden hover:opacity-80 transition-opacity"
        >
          {post.profiles?.avatar_url ? (
            <img src={post.profiles.avatar_url} alt={post.profiles.username} className="w-full h-full object-cover" />
          ) : initials}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center min-w-0 overflow-hidden">
              <button
                onClick={() => navigate(`/u/${post.profiles?.username}`)}
                className="flex items-center gap-1 group text-left min-w-0 overflow-hidden"
              >
                <span className="font-bold text-sm group-hover:underline truncate shrink-0 max-w-[140px] xs:max-w-[180px] sm:max-w-[220px]">{post.profiles?.display_name || "Unknown"}</span>
                <span className="text-muted-foreground text-sm truncate shrink ml-1">@{post.profiles?.username || "?"}</span>
                <span className="text-muted-foreground text-xs shrink-0 whitespace-nowrap ml-1">· {timeAgo(post.created_at)}</span>
                {post.edited_at && (
                  <span className="text-muted-foreground text-[10px] shrink-0 whitespace-nowrap ml-1">(edited)</span>
                )}
              </button>
              <div className="flex items-center gap-2 sm:ml-2 mt-0.5 sm:mt-0">
                <span className="text-primary/70 text-[9px] font-bold shrink-0 whitespace-nowrap">
                  [{getTimeRemaining(post.created_at)}]
                </span>
                <span className="shrink-0 inline-flex items-center gap-1 text-muted-foreground text-[10px] font-medium" title="Views">
                  <Eye size={12} />
                  {viewCount}
                </span>
              </div>
            </div>
            {isOwner && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded-[3px] hover:bg-secondary transition-colors"
                >
                  <MoreHorizontal size={16} className="text-muted-foreground" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 gum-card p-1 z-10 min-w-[120px]">
                    <button
                      onClick={() => {
                        setIsEditDialogOpen(true);
                        setShowMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-secondary rounded-[3px] transition-colors"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => { onDelete?.(post.id); setShowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-secondary rounded-[3px] transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isOwner && (
            <EditPostDialog
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
              post={post}
              onEdited={(updated) => onPostEdited?.(post.id, updated)}
            />
          )}

          {post.is_readme ? (
            <div className="mt-3 p-4 rounded-[3px] gum-border bg-secondary/10 prose-readme">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkGemoji]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={highlighterTheme}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-[3px] my-4"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {displayContent}
              </ReactMarkdown>

              {isLongPost && (
                <button
                  onClick={() => setIsTextExpanded(!isTextExpanded)}
                  className="text-primary font-semibold mt-2 hover:underline focus:outline-none text-sm"
                >
                  {isTextExpanded ? 'See Less' : 'See More'}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
              <p>
                {linkify(displayContent)}
              </p>

              {isLongPost && (
                <button
                  onClick={() => setIsTextExpanded(!isTextExpanded)}
                  className="text-primary font-semibold mt-1 hover:underline focus:outline-none text-sm"
                >
                  {isTextExpanded ? 'See Less' : 'See More'}
                </button>
              )}
            </div>
          )}

          {post.media_url && (
            <>
              <button
                type="button"
                onClick={() => setIsImagePreviewOpen(true)}
                className="mt-3 w-full rounded-[3px] gum-border overflow-hidden bg-muted cursor-pointer hover:opacity-95 transition-opacity"
              >
                <img
                  src={post.media_url}
                  alt="Post content"
                  className="w-full h-auto max-h-[500px] object-contain mx-auto"
                  loading="lazy"
                />
              </button>
              <ImagePreviewDialog
                src={post.media_url}
                isOpen={isImagePreviewOpen}
                onOpenChange={setIsImagePreviewOpen}
                alt="Post content"
              />
            </>
          )}

          {post.code && (
            <div className="mt-3 overflow-x-auto relative">
              <SyntaxHighlighter
                style={highlighterTheme}
                language={post.code_language || "javascript"}
                PreTag="div"
                className="rounded-[3px] !m-0 gum-border text-xs"
                customStyle={{ padding: "16px", background: "hsl(var(--muted))" }}
              >
                {isLongCode && !isCodeExpanded ? truncatedCode : post.code}
              </SyntaxHighlighter>
              {isLongCode && (
                <button
                  onClick={() => setIsCodeExpanded(!isCodeExpanded)}
                  className="text-primary font-semibold mt-2 hover:underline focus:outline-none text-xs"
                >
                  {isCodeExpanded ? 'See Less' : 'See More'}
                </button>
              )}
            </div>
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/search?q=${encodeURIComponent(tag.startsWith('#') ? tag : '#' + tag)}`);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-mono font-medium bg-secondary px-2.5 py-1 rounded-[3px] gum-border gum-shadow-sm cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-all active:scale-95"
                >
                  <Hash size={10} />
                  {tag}
                </span>
              ))}
            </div>
          )}


          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6 mt-4 pt-3 border-t border-secondary">
            <motion.button
              onClick={handleLikeClick}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-medium transition-colors ${post.user_liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                } relative`}
              whileTap={{ scale: 0.92 }}
              animate={isLikeAnimating ? { scale: [1, 1.18, 0.96, 1] } : { scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <motion.span
                animate={isLikeAnimating ? { rotate: [0, -14, 12, -8, 0] } : { rotate: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="inline-flex"
              >
                <Heart size={15} fill={post.user_liked ? "currentColor" : "none"} className={post.user_liked ? "text-red-500" : ""} />
              </motion.span>
              {post.likes_count}

              <AnimatePresence>
                {isLikeAnimating && (
                  <motion.span
                    key={`like-burst-${likeBurstId}`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45 }}
                    className="pointer-events-none absolute inset-0"
                  >
                    {[
                      { x: -18, y: -20, delay: 0.0 },
                      { x: 0, y: -26, delay: 0.03 },
                      { x: 18, y: -20, delay: 0.06 },
                      { x: -22, y: -4, delay: 0.09 },
                      { x: 22, y: -4, delay: 0.12 },
                    ].map((particle, idx) => (
                      <motion.span
                        key={`${likeBurstId}-${idx}`}
                        initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                        animate={{ opacity: [0, 1, 0], x: particle.x, y: particle.y, scale: [0.5, 1, 0.6] }}
                        transition={{ duration: 0.45, ease: "easeOut", delay: particle.delay }}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500"
                      >
                        <Heart size={10} fill="currentColor" />
                      </motion.span>
                    ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <Link
              to={`/post/${post.id}`}
              className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageSquare size={15} />
              {post.comments_count}
            </Link>
            {!isOwner && (
              <button
                onClick={() => {
                  if (!user) {
                    toast.error("Please sign in to send messages");
                    return;
                  }
                  navigate(`/whisper/${post.profiles?.username}`);
                }}
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                title="Whisper to author"
              >
                <Send size={15} />
              </button>
            )}
            <button
              onClick={() => onBookmark(post.id, post.user_bookmarked)}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-medium transition-colors ${post.user_bookmarked ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}`}
            >
              <Bookmark size={15} fill={post.user_bookmarked ? "currentColor" : "none"} />
            </button>

            {/* Translation Button */}
            {!isAlreadyEnglish && (
              <button
                onClick={handleTranslate}
                disabled={isTranslating}
                className={`shrink-0 flex items-center gap-1.5 text-xs font-medium transition-colors ${isShowingTranslation ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
                title={isShowingTranslation ? "Show Original" : "Translate to English"}
              >
                {isTranslating ? (
                  <FrogLoader size={15} className="" />
                ) : (
                  <Languages size={15} />
                )}
                <span className="hidden xs:inline">
                  {isShowingTranslation ? "Original" : "Translate"}
                </span>
              </button>
            )}

            <button
              onClick={handleShare}
              className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              title="Share post"
            >
              <Share size={15} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
});

export default PostCard;
