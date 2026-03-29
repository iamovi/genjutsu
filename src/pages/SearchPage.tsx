import { useState, useEffect } from "react";
import { Search as SearchIcon, User, Hash, Loader2, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import PostCard from "@/components/PostCard";
import { PostWithProfile } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { usePostActions } from "@/hooks/usePostActions";
import { getNow } from "@/lib/utils";

const SearchPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("q") || "";
    const [searchTerm, setSearchTerm] = useState(query);
    const [results, setResults] = useState<{ profiles: any[], posts: PostWithProfile[] }>({ profiles: [], posts: [] });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"posts" | "users">("posts");
    const { user } = useAuth();
    const navigate = useNavigate();

    const performSearch = async (val: string) => {
        if (!val.trim()) {
            setResults({ profiles: [], posts: [] });
            return;
        }

        setLoading(true);
        try {
            // Sanitize input to prevent broken PostgREST filters
            const sanitized = val.replace(/[%_(),."'\\]/g, "");
            if (!sanitized.trim()) {
                setResults({ profiles: [], posts: [] });
                setLoading(false);
                return;
            }

            // 1. Search Profiles
            const { data: profiles } = await supabase
                .from("profiles")
                .select("*")
                .or(`username.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%`)
                .limit(10);

            // 2. Search Posts
            const { data: postsData } = await (supabase
                .from("posts")
                .select(`
                    id, content, code, media_url, tags, created_at, user_id, is_readme,
                    profiles ( username, display_name, avatar_url )
                `) as any)
                .or(`content.ilike.%${sanitized}%,tags.cs.{${sanitized.replace('#', '')}}`)
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false })
                .limit(20);

            if (postsData) {
                const postIds = (postsData as any[]).map(p => p.id);

                const [{ data: likesData }, { data: commentsData }] = await Promise.all([
                    supabase.from("likes").select("post_id").in("post_id", postIds),
                    supabase.from("comments").select("post_id").in("post_id", postIds)
                ]);

                const likesCounts: Record<string, number> = {};
                (likesData || []).forEach((l: any) => {
                    likesCounts[l.post_id] = (likesCounts[l.post_id] || 0) + 1;
                });

                const commentsCounts: Record<string, number> = {};
                (commentsData || []).forEach((c: any) => {
                    commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
                });

                let userLikes = new Set<string>();
                let userBookmarks = new Set<string>();

                if (user) {
                    const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
                        supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
                        supabase.from("bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds)
                    ]);
                    userLikes = new Set((myLikes || []).map(l => l.post_id));
                    userBookmarks = new Set((myBookmarks || []).map(b => b.post_id));
                }

                const enrichedPosts = postsData.map((p: any) => ({
                    ...p,
                    profiles: p.profiles as any,
                    likes_count: likesCounts[p.id] || 0,
                    comments_count: commentsCounts[p.id] || 0,
                    user_liked: userLikes.has(p.id),
                    user_bookmarked: userBookmarks.has(p.id)
                })) as PostWithProfile[];

                setResults({
                    profiles: profiles || [],
                    posts: enrichedPosts
                });
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== query) {
                setSearchParams(searchTerm ? { q: searchTerm } : {});
            }
            if (searchTerm) {
                performSearch(searchTerm);
            } else {
                setResults({ profiles: [], posts: [] });
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (query && query !== searchTerm) {
            setSearchTerm(query);
        }
    }, [query]);

    const { toggleLike, toggleBookmark, deletePost } = usePostActions();

    const handleLike = (postId: string, currentlyLiked: boolean) => {
        if (!user) {
            toast.error("Please sign in to like posts");
            return;
        }
        toggleLike(postId, currentlyLiked);
        setResults(prev => ({
            ...prev,
            posts: prev.posts.map(p => p.id === postId ? {
                ...p,
                user_liked: !currentlyLiked,
                likes_count: currentlyLiked ? p.likes_count - 1 : p.likes_count + 1
            } : p)
        }));
    };

    const handleBookmark = (postId: string, currentlyBookmarked: boolean) => {
        if (!user) {
            toast.error("Please sign in to bookmark posts");
            return;
        }
        toggleBookmark(postId, currentlyBookmarked);
        setResults(prev => ({
            ...prev,
            posts: prev.posts.map(p => p.id === postId ? {
                ...p,
                user_bookmarked: !currentlyBookmarked
            } : p)
        }));
    };

    const handleDelete = async (postId: string) => {
        if (!user) return;
        try {
            await deletePost(postId);
            setResults(prev => ({
                ...prev,
                posts: prev.posts.filter(p => p.id !== postId)
            }));
        } catch (err) {
            toast.error("Failed to delete post");
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>{query ? `Search: ${query} — genjutsu` : "Search — genjutsu"}</title>
            </Helmet>
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 hover:bg-secondary rounded-[3px] transition-colors border-2 border-transparent hover:border-border"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="flex-1 relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    id="search-input"
                                    name="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search users, echoes, or #hashtags..."
                                    className="w-full bg-secondary/50 gum-border py-2.5 pl-10 pr-4 outline-none focus:border-primary transition-colors text-sm"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 border-b border-border pb-px">
                            {(["posts", "users"] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-2.5 text-sm font-bold capitalize transition-all relative ${activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {tab}
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                        />
                                    )}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-primary" size={32} />
                                <p className="text-sm text-muted-foreground font-medium">Searching the abyss...</p>
                            </div>
                        ) : query ? (
                            <div className="space-y-6">
                                {activeTab === "posts" ? (
                                    results.posts.length > 0 ? (
                                        <div className="space-y-6">
                                            {results.posts.map(post => (
                                                <PostCard
                                                    key={post.id}
                                                    post={post}
                                                    onLike={handleLike}
                                                    onBookmark={handleBookmark}
                                                    onDelete={handleDelete}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="gum-card p-12 text-center text-muted-foreground">
                                            No echoes found for "{query}"
                                        </div>
                                    )
                                ) : (
                                    results.profiles.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {results.profiles.map(profile => (
                                                <div
                                                    key={profile.id}
                                                    onClick={() => navigate(`/u/${profile.username}`)}
                                                    className="gum-card p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/50 transition-colors group"
                                                >
                                                    <div className="w-12 h-12 rounded-[3px] gum-border bg-secondary overflow-hidden shrink-0">
                                                        {profile.avatar_url ? (
                                                            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center font-bold text-lg">
                                                                {profile.display_name[0].toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold truncate group-hover:underline">{profile.display_name}</h4>
                                                        <p className="text-xs text-muted-foreground">@{profile.username}</p>
                                                    </div>
                                                    {user && user.id !== profile.user_id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/whisper/${profile.username}`);
                                                            }}
                                                            className="p-2 rounded-[3px] bg-secondary hover:bg-primary hover:text-primary-foreground transition-all gum-border shrink-0"
                                                            title="Whisper"
                                                        >
                                                            <Send size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="gum-card p-12 text-center text-muted-foreground">
                                            No users found for "{query}"
                                        </div>
                                    )
                                )}
                            </div>
                        ) : (
                            <div className="gum-card p-12 text-center flex flex-col items-center gap-4 bg-secondary/20 border-dashed">
                                <div className="w-16 h-16 rounded-[3px] bg-secondary flex items-center justify-center">
                                    <SearchIcon size={32} className="text-muted-foreground" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">Find what you're looking for</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                        Search for users, specific keywords, or use #hashtags to find trending topics.
                                    </p>
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

export default SearchPage;
