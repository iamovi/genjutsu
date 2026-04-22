import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostWithProfile } from "@/hooks/usePosts";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import { ArrowLeft, Send, MessageSquare, MoreHorizontal, Trash2, Languages } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow } from "date-fns";
import { usePostActions } from "@/hooks/usePostActions";
import { usePostViews } from "@/hooks/usePostViews";
import { linkify } from "@/lib/linkify";
import { getConfig } from "@/lib/config";
import { useMentions } from "@/hooks/useMentions";
import { AnimatePresence, motion } from "framer-motion";
import MentionList from "@/components/MentionList";

const CommentItem = ({ 
    comment, 
    post, 
    user, 
    navigate, 
    formatDistanceToNow, 
    openCommentMenuId, 
    setOpenCommentMenuId, 
    deletingCommentId, 
    handleDeleteComment 
}: any) => {
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isShowingTranslation, setIsShowingTranslation] = useState(false);

    const isAlreadyEnglish = useMemo(() => {
        const text = comment.content?.trim() || "";
        if (!text) return true;
        // eslint-disable-next-line no-misleading-character-class
        const hasOtherScripts = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0980-\u09FF\u0900-\u097F\u0E00-\u0E7F\u0370-\u03FF\u0590-\u05FF\u0B80-\u0BFF\u0A80-\u0AFF\u0C00-\u0C7F]/.test(text);
        if (hasOtherScripts) return false;
        const commonEnglishWords = /\b(the|and|is|it|you|that|in|was|for|on|are|with|as|I|be|at|have|from|this|but|his|by|they|we|say|her|she|or|an|will|my|one|all|would|there|their|what|so|up|out|if|about|who|get|which|go|me)\b/i;
        // eslint-disable-next-line no-control-regex
        return commonEnglishWords.test(text) || (text.length < 30 && !/[^\x00-\x7F]/.test(text));
    }, [comment.content]);

    const handleTranslate = async () => {
        if (isShowingTranslation) {
            setIsShowingTranslation(false);
            return;
        }
        if (translatedContent) {
            setIsShowingTranslation(true);
            return;
        }
        if (isAlreadyEnglish) {
            toast.info("This comment is already in English.");
            return;
        }
        try {
            setIsTranslating(true);
            const apiUrl = getConfig().VITE_LANG_SERVICE;
            const response = await fetch(`${apiUrl}/api/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: comment.content, target: 'en' })
            });
            if (!response.ok) throw new Error();
            const data = await response.json();
            setTranslatedContent(data.translatedText);
            setIsShowingTranslation(true);
            toast.success("Translated to English");
        } catch (error) {
            toast.error("Could not translate comment.");
        } finally {
            setIsTranslating(false);
        }
    };

    const displayContent = isShowingTranslation && translatedContent ? translatedContent : comment.content;

    return (
        <div className="gum-card p-4 bg-background/50">
            <div className="flex gap-3">
                <button
                    onClick={() => navigate(`/u/${comment.profiles?.username}`)}
                    className="w-8 h-8 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden hover:opacity-80 transition-opacity"
                >
                    {comment.profiles?.avatar_url ? (
                        <img src={comment.profiles.avatar_url} alt={comment.profiles.username} className="w-full h-full object-cover" />
                    ) : comment.profiles?.display_name?.[0] || "?"}
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <button
                            onClick={() => navigate(`/u/${comment.profiles?.username}`)}
                            className="flex items-center gap-1.5 group text-left min-w-0"
                        >
                            <span className="font-bold text-xs group-hover:underline truncate">
                                {comment.profiles?.display_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors truncate hidden xs:inline">
                                @{comment.profiles?.username}
                            </span>
                        </button>
                        <span className="text-[10px] text-muted-foreground opacity-60 shrink-0">
                            • {formatDistanceToNow(new Date(comment.created_at))} ago
                        </span>

                        <div className="flex items-center gap-1 ml-auto shrink-0">
                            {/* Translate Button */}
                            {!isAlreadyEnglish && (
                                <button
                                    onClick={handleTranslate}
                                    disabled={isTranslating}
                                    className={`px-1.5 py-0.5 rounded-[3px] transition-colors flex items-center gap-1.5 border border-transparent ${isShowingTranslation ? "text-primary bg-primary/10 border-primary/20" : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-border"}`}
                                    title={isShowingTranslation ? "Show Original" : "Translate"}
                                >
                                    {isTranslating ? <FrogLoader size={12} className="" /> : <Languages size={12} />}
                                    <span className="text-[10px] font-medium hidden xs:inline">{isShowingTranslation ? "Original" : "Translate"}</span>
                                </button>
                            )}

                            {/* Menu Button */}
                            {(user?.id === comment.user_id || (post && user?.id === post.user_id)) && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        aria-label="Open comment menu"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenCommentMenuId(openCommentMenuId === comment.id ? null : comment.id);
                                        }}
                                        className="p-1 rounded-[3px] hover:bg-secondary transition-colors"
                                    >
                                        <MoreHorizontal size={14} className="text-muted-foreground" />
                                    </button>

                                    {openCommentMenuId === comment.id && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setOpenCommentMenuId(null)}
                                            />
                                            <div className="absolute right-0 mt-1 z-20 min-w-[110px] gum-card bg-background p-1 shadow-xl border border-secondary">
                                                <button
                                                    type="button"
                                                    disabled={deletingCommentId === comment.id}
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-[3px] transition-colors disabled:opacity-50"
                                                >
                                                    {deletingCommentId === comment.id ? (
                                                        <span className="flex items-center gap-2">
                                                            <FrogLoader size={10} className="" /> Deleting...
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <Trash2 size={14} />
                                                            <span>Delete Echo</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {linkify(displayContent)}
                    </p>
                </div>
            </div>
        </div>
    );
};

const PostPage = () => {
    const { postId } = useParams<{ postId: string }>();
    const [post, setPost] = useState<PostWithProfile | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [submittingComment, setSubmittingComment] = useState(false);
    const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const { user } = useAuth();

    // Mention state
    const { suggestions, fetchSuggestions, clearSuggestions } = useMentions();
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionIndex, setMentionIndex] = useState(-1);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const navigate = useNavigate();
    const { toggleLike, toggleBookmark, deletePost } = usePostActions();
    const { recordView } = usePostViews();


    const fetchPost = async () => {
        if (!postId) return;

        try {
            setLoading(true);
            const { data: p, error } = await (supabase
                .from("posts")
                .select(`
          id, content, code, code_language, media_url, tags, created_at, edited_at, user_id, is_readme, views_count,
          profiles ( username, display_name, avatar_url )
        `) as any)
                .eq("id", postId)
                .single();

            if (error) throw error;
            if (!p) throw new Error("Post not found");

            // Fetch likes count
            const { count: likesCount } = await supabase
                .from("likes")
                .select("*", { count: 'exact', head: true })
                .eq("post_id", postId);

            // Fetch comments count
            const { count: commentsCount } = await supabase
                .from("comments")
                .select("*", { count: 'exact', head: true })
                .eq("post_id", postId);

            // Fetch comments with profiles
            const { data: commentsData } = await supabase
                .from("comments")
                .select(`
                    *,
                    profiles ( username, display_name, avatar_url )
                `)
                .eq("post_id", postId)
                .order("created_at", { ascending: true });

            // Check if user liked
            let userLiked = false;
            let userBookmarked = false;
            if (user) {
                const { data: likeData } = await supabase
                    .from("likes")
                    .select("id")
                    .eq("post_id", postId)
                    .eq("user_id", user.id)
                    .maybeSingle();
                userLiked = !!likeData;

                const { data: bookmarkData } = await supabase
                    .from("bookmarks")
                    .select("id")
                    .eq("post_id", postId)
                    .eq("user_id", user.id)
                    .maybeSingle();
                userBookmarked = !!bookmarkData;
            }

            setPost({
                ...p,
                profiles: p.profiles as any,
                views_count: Number(p.views_count || 0),
                likes_count: likesCount || 0,
                user_liked: userLiked,
                user_bookmarked: userBookmarked,
                comments_count: commentsCount || 0
            } as PostWithProfile);
            setComments(commentsData || []);
        } catch (err: any) {
            console.error("Error fetching post:", err);
            toast.error(err.message || "Failed to load post");
        } finally {
            setLoading(false);
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error("Please sign in to comment");
            return;
        }
        if (!commentText.trim() || submittingComment) return;

        setSubmittingComment(true);
        try {
            const idempotency_key = crypto.randomUUID();
            const { data: rpcResult, error: rpcError } = await supabase.rpc("create_comment", {
                p_post_id: postId!,
                p_content: commentText.trim(),
                p_idempotency_key: idempotency_key,
            });

            if (rpcError) throw rpcError;

            const result = rpcResult as any;
            if (result?.error === "cooldown_active") {
                toast.error(`Please wait ${result.retry_after}s before commenting again.`);
                return;
            }
            if (result?.error === "banned") {
                if (result.ban_permanent) {
                    toast.error("You are permanently banned from commenting.");
                } else if (result.banned_until) {
                    const until = new Date(result.banned_until);
                    toast.error(`You are banned from commenting until ${until.toLocaleString()}.`);
                } else {
                    toast.error("You are currently banned from commenting.");
                }
                return;
            }
            if (result?.error) {
                throw new Error(result.message || "Failed to add comment");
            }

            // Fetch the newly created comment with profile data
            const { data: newComment } = await supabase
                .from("comments")
                .select(`
                    *,
                    profiles ( username, display_name, avatar_url )
                `)
                .eq("id", result.comment_id)
                .single();

            if (newComment) {
                setComments(prev => [...prev, newComment]);
            }
            setCommentText("");
            setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : null);
            toast.success("Echo shared!");
        } catch (err: any) {
            toast.error("Failed to add comment");
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setCommentText(val);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = val.substring(0, cursorPosition);
        const mentionMatch = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);

        if (mentionMatch) {
            const query = mentionMatch[1];
            setMentionSearch(query);
            setMentionIndex(cursorPosition - query.length - 1);
            fetchSuggestions(query);
        } else {
            setMentionSearch("");
            clearSuggestions();
        }
    };

    const insertMention = (username: string) => {
        if (mentionIndex === -1) return;

        const before = commentText.substring(0, mentionIndex);
        const after = commentText.substring(mentionIndex + mentionSearch.length + 1);
        const newText = `${before}@${username} ${after}`;

        setCommentText(newText);
        setMentionSearch("");
        clearSuggestions();

        // Focus back on textarea
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    useEffect(() => {
        fetchPost();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId, user?.id]);

    useEffect(() => {
        if (!post?.id) return;
        let isActive = true;

        void recordView(post.id, "detail_open").then((count) => {
            if (!isActive || typeof count !== "number") return;
            setPost((prev) => {
                if (!prev || prev.id !== post.id) return prev;
                return {
                    ...prev,
                    views_count: Math.max(prev.views_count || 0, count),
                };
            });
        });

        return () => {
            isActive = false;
        };
    }, [post?.id, recordView]);

    const handleLike = async (id: string, currentlyLiked: boolean) => {
        if (!user) {
            toast.error("Please sign in to like posts");
            return;
        }
        toggleLike(id, currentlyLiked);
        // Local state sync for the single post page context
        setPost(prev => prev ? {
            ...prev,
            user_liked: !currentlyLiked,
            likes_count: currentlyLiked ? prev.likes_count - 1 : prev.likes_count + 1
        } : null);
    };

    const handleBookmark = async (id: string, currentlyBookmarked: boolean) => {
        if (!user) {
            toast.error("Please sign in to bookmark posts");
            return;
        }
        toggleBookmark(id, currentlyBookmarked);
        // Local state sync
        setPost(prev => prev ? { ...prev, user_bookmarked: !currentlyBookmarked } : null);
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
        try {
            await deletePost(id);
            navigate("/");
        } catch (err) {
            toast.error("Failed to delete post");
        }
    };

    const handlePostEdited = (id: string, updated: {
        content: string;
        code: string;
        code_language: string | null;
        media_url: string | null;
        is_readme: boolean;
        tags: string[];
        edited_at: string | null;
    }) => {
        setPost(prev => prev && prev.id === id ? { ...prev, ...updated } : prev);
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!user || deletingCommentId) return;

        try {
            setDeletingCommentId(commentId);
            const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("delete_comment", {
                p_comment_id: commentId,
            });

            if (rpcError) throw rpcError;

            const result = rpcResult as any;
            if (result?.error) {
                throw new Error(result.message || "Failed to delete comment");
            }

            setComments(prev => prev.filter(comment => comment.id !== commentId));
            setPost(prev => prev ? { ...prev, comments_count: Math.max(0, prev.comments_count - 1) } : null);
            setOpenCommentMenuId(null);
            toast.success("Comment deleted");
        } catch (err: any) {
            toast.error(err.message || "Failed to delete comment");
        } finally {
            setDeletingCommentId(null);
        }
    };

    const pageTitle = post ? `${post.profiles?.display_name || "User"}: "${post.content.substring(0, 30)}${post.content.length > 30 ? '...' : ''}" — genjutsu` : "Post — genjutsu";
    const pageDesc = post ? post.content.substring(0, 160) : "View this post on genjutsu.";

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDesc} />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDesc} />
                <meta property="og:image" content={post?.profiles?.avatar_url || "/fav.jpg"} />
            </Helmet>
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                    <div>
                        <button
                            onClick={() => navigate("/")}
                            className="inline-flex items-center gap-2 px-3 py-1.5 gum-card bg-secondary text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-colors w-fit mb-6"
                        >
                            <ArrowLeft size={14} />
                            Back to Home
                        </button>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <FrogLoader className="" size={24} />
                            </div>
                        ) : !post ? (
                            <div className="gum-card p-8 text-center">
                                <p className="text-muted-foreground text-sm">Post not found.</p>
                                <button
                                    onClick={() => navigate("/")}
                                    className="mt-4 text-primary hover:underline text-sm font-bold"
                                >
                                    Go Home
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <PostCard
                                    post={post}
                                    onLike={handleLike}
                                    onBookmark={handleBookmark}
                                    onDelete={handleDelete}
                                    onPostEdited={handlePostEdited}
                                />

                                {/* Comments Section */}
                                <div className="mt-8">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <MessageSquare size={20} />
                                        Echoes ({post.comments_count})
                                    </h3>

                                    {user && (
                                        <form onSubmit={handleComment} className="gum-card p-4 mb-6">
                                            <div className="flex gap-3">
                                                <div className="flex-1 relative">
                                                    <textarea
                                                        ref={textareaRef}
                                                        id="comment-content"
                                                        name="comment"
                                                        value={commentText}
                                                        onChange={handleTextareaChange}
                                                        placeholder="Add your reflection..."
                                                        className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground min-h-[60px]"
                                                        rows={2}
                                                    />

                                                    <MentionList
                                                        suggestions={suggestions}
                                                        onSelect={insertMention}
                                                        containerRef={textareaRef}
                                                    />

                                                    <div className="flex justify-end mt-2 pt-2 border-t border-secondary">
                                                        <button
                                                            type="submit"
                                                            disabled={!commentText.trim() || submittingComment}
                                                            className="gum-btn bg-primary text-primary-foreground text-xs flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            {submittingComment ? <FrogLoader size={12} className="" /> : <Send size={12} />}
                                                            Echo
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </form>
                                    )}

                                    <div className="space-y-4">
                                        {comments.length === 0 ? (
                                            <div className="gum-card p-8 text-center bg-secondary/30 border-dashed">
                                                <p className="text-muted-foreground text-sm italic">No echoes yet. Silent is the night...</p>
                                            </div>
                                        ) : (
                                            comments.map((comment) => (
                                                <CommentItem
                                                    key={comment.id}
                                                    comment={comment}
                                                    post={post}
                                                    user={user}
                                                    navigate={navigate}
                                                    formatDistanceToNow={formatDistanceToNow}
                                                    openCommentMenuId={openCommentMenuId}
                                                    setOpenCommentMenuId={setOpenCommentMenuId}
                                                    deletingCommentId={deletingCommentId}
                                                    handleDeleteComment={handleDeleteComment}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="hidden lg:block lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 custom-scrollbar">
                        <Sidebar />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PostPage;
