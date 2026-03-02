import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostWithProfile } from "@/hooks/usePosts";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import { Loader2, ArrowLeft, Send, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow } from "date-fns";
import { usePostActions } from "@/hooks/usePostActions";

const PostPage = () => {
    const { postId } = useParams<{ postId: string }>();
    const [post, setPost] = useState<PostWithProfile | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [submittingComment, setSubmittingComment] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toggleLike, toggleBookmark, deletePost } = usePostActions();

    const fetchPost = async () => {
        if (!postId) return;

        try {
            setLoading(true);
            const { data: p, error } = await supabase
                .from("posts")
                .select(`
          id, content, code, media_url, tags, created_at, user_id,
          profiles ( username, display_name, avatar_url )
        `)
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
            toast.error("Sign in to comment");
            return;
        }
        if (!commentText.trim() || submittingComment) return;

        setSubmittingComment(true);
        try {
            const { data, error } = await supabase
                .from("comments")
                .insert({
                    post_id: postId,
                    user_id: user.id,
                    content: commentText.trim()
                })
                .select(`
                    *,
                    profiles ( username, display_name, avatar_url )
                `)
                .single();

            if (error) throw error;

            setComments(prev => [...prev, data]);
            setCommentText("");
            setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : null);
            toast.success("Echo shared!");
        } catch (err: any) {
            toast.error("Failed to add comment");
        } finally {
            setSubmittingComment(false);
        }
    };

    useEffect(() => {
        fetchPost();
    }, [postId, user]);

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
                                <Loader2 className="animate-spin" size={24} />
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
                                                <div className="flex-1">
                                                    <textarea
                                                        value={commentText}
                                                        onChange={(e) => setCommentText(e.target.value)}
                                                        placeholder="Add your reflection..."
                                                        className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground min-h-[60px]"
                                                        rows={2}
                                                    />
                                                    <div className="flex justify-end mt-2 pt-2 border-t border-secondary">
                                                        <button
                                                            type="submit"
                                                            disabled={!commentText.trim() || submittingComment}
                                                            className="gum-btn bg-primary text-primary-foreground text-xs flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            {submittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
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
                                                <div key={comment.id} className="gum-card p-4 bg-background/50">
                                                    <div className="flex gap-3">
                                                        <div className="w-8 h-8 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                                            {comment.profiles?.avatar_url ? (
                                                                <img src={comment.profiles.avatar_url} alt={comment.profiles.username} className="w-full h-full object-cover" />
                                                            ) : comment.profiles?.display_name?.[0] || "?"}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-xs">{comment.profiles?.display_name}</span>
                                                                <span className="text-[10px] text-muted-foreground">@{comment.profiles?.username}</span>
                                                                <span className="text-[10px] text-muted-foreground opacity-60">• {formatDistanceToNow(new Date(comment.created_at))} ago</span>
                                                            </div>
                                                            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="hidden lg:block">
                        <div className="sticky top-20">
                            <Sidebar />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PostPage;
