import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostWithProfile } from "@/hooks/usePosts";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import { Edit3, Loader2, ArrowLeft, Calendar, Link as LinkIcon, UserPlus, UserCheck, Trash2, LogOut, MoreHorizontal, ImageIcon, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import EditProfileDialog from "@/components/EditProfileDialog";
import FollowsList from "@/components/FollowsList";
import { PostSkeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";

import { useFollow } from "@/hooks/useFollow";
import { usePostActions } from "@/hooks/usePostActions";

interface ProfileData {
    id: string;
    user_id: string;
    username: string;
    display_name: string;
    bio: string;
    avatar_url: string;
    banner_url: string;
    created_at: string;
}

const ProfilePage = () => {
    const { username } = useParams<{ username: string }>();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [posts, setPosts] = useState<PostWithProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const [followsModalOpen, setFollowsModalOpen] = useState(false);
    const [followsModalType, setFollowsModalType] = useState<"followers" | "following">("followers");
    const { user } = useAuth();
    const navigate = useNavigate();

    // Use our new professional hook
    const { isFollowing, toggleFollow, stats, refresh: refreshFollows } = useFollow(profile?.user_id);

    const fetchData = async () => {
        if (!username) return;

        try {
            setLoading(true);

            // 1. Fetch Profile
            const { data: p, error: pError } = await supabase
                .from("profiles")
                .select("*")
                .eq("username", username.toLowerCase())
                .single();

            if (pError) throw pError;
            if (!p) throw new Error("Profile not found");
            setProfile(p as ProfileData);

            // 2. Fetch Posts
            const { data: postsData } = await supabase
                .from("posts")
                .select(`
                  id, content, code, media_url, tags, created_at, user_id,
                  profiles ( username, display_name, avatar_url )
                `)
                .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .eq("user_id", p.user_id)
                .order("created_at", { ascending: false });

            if (postsData && p) {
                const postIds = postsData.map(post => post.id);

                // Fetch counts and user status
                const [{ data: likesData }, { data: commentsData }] = await Promise.all([
                    supabase.from("likes").select("post_id").in("post_id", postIds),
                    supabase.from("comments").select("post_id").in("post_id", postIds),
                ]);

                const likesCounts: Record<string, number> = {};
                (likesData || []).forEach((l: any) => {
                    likesCounts[l.post_id] = (likesCounts[l.post_id] || 0) + 1;
                });

                const commentsCounts: Record<string, number> = {};
                (commentsData || []).forEach((c: any) => {
                    commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
                });

                // Fetch user's status
                let userLikes: Set<string> = new Set();
                let userBookmarks: Set<string> = new Set();

                if (user) {
                    const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
                        supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
                        supabase.from("bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds),
                    ]);
                    userLikes = new Set((myLikes || []).map((l: any) => l.post_id));
                    userBookmarks = new Set((myBookmarks || []).map((b: any) => b.post_id));
                }

                const enriched = postsData.map(post => ({
                    ...post,
                    profiles: post.profiles as any,
                    likes_count: likesCounts[post.id] || 0,
                    user_liked: userLikes.has(post.id),
                    user_bookmarked: userBookmarks.has(post.id),
                    comments_count: commentsCounts[post.id] || 0
                } as PostWithProfile));
                setPosts(enriched);
            }

        } catch (err: any) {
            console.error("Error fetching profile:", err);
            toast.error("Profile not found");
            navigate("/");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [username, user]);

    const { toggleLike, toggleBookmark, deletePost } = usePostActions();

    const handleLike = async (postId: string, currentlyLiked: boolean) => {
        if (!user) {
            toast.error("Please sign in to like posts");
            return;
        }

        toggleLike(postId, currentlyLiked);
        // Local state sync
        setPosts((prev) =>
            prev.map((p) => {
                if (p.id === postId) {
                    return {
                        ...p,
                        user_liked: !currentlyLiked,
                        likes_count: currentlyLiked ? p.likes_count - 1 : p.likes_count + 1,
                    };
                }
                return p;
            })
        );
    };

    const handleBookmark = async (postId: string, currentlyBookmarked: boolean) => {
        if (!user) {
            toast.error("Please sign in to bookmark posts");
            return;
        }

        toggleBookmark(postId, currentlyBookmarked);
        // Local state sync
        setPosts((prev) =>
            prev.map((p) => {
                if (p.id === postId) {
                    return { ...p, user_bookmarked: !currentlyBookmarked };
                }
                return p;
            })
        );
    };

    const handleDelete = async (postId: string) => {
        if (!user) return;
        try {
            await deletePost(postId);
            // Local state sync
            setPosts((prev) => prev.filter((p) => p.id !== postId));
        } catch (err) {
            toast.error("Failed to delete post");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background text-foreground">
                <Navbar />
                <main className="max-w-6xl mx-auto px-4 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
                        <div className="space-y-6">
                            <PostSkeleton />
                            <PostSkeleton />
                            <PostSkeleton />
                        </div>
                        <div className="hidden lg:block">
                            <Sidebar />
                        </div>
                    </div>
                </main>
            </div>
        );
    }


    if (!profile) return null;

    const initials = profile.display_name.substring(0, 2).toUpperCase();
    const isOwnProfile = user?.id === profile.user_id;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>{profile.display_name} (@{profile.username}) — genjutsu</title>
                <meta name="description" content={profile.bio || `Check out ${profile.display_name}'s profile on genjutsu.`} />
                <meta property="og:title" content={`${profile.display_name} (@${profile.username}) — genjutsu`} />
                <meta property="og:description" content={profile.bio || `Check out ${profile.display_name}'s profile on genjutsu.`} />
                <meta property="og:image" content={profile.avatar_url || "/fav.jpg"} />
            </Helmet>
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
                    <div className="space-y-4">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-3 py-1.5 gum-card bg-secondary text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-colors w-fit"
                        >
                            <ArrowLeft size={14} />
                            Back to Home
                        </Link>
                        <div className="gum-card overflow-hidden mb-8">
                            <div className="h-48 bg-secondary relative overflow-hidden flex items-center justify-center">
                                {profile.banner_url ? (
                                    <img
                                        src={profile.banner_url}
                                        alt="Banner"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 opacity-20">
                                        <ImageIcon size={48} />
                                        <span className="text-xs font-bold uppercase tracking-widest">Genjutsu Illusion</span>
                                    </div>
                                )}
                            </div>
                            <div className="px-6 pb-6 relative">
                                <div className="absolute -top-12 left-6">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <div className="w-24 h-24 rounded-[3px] gum-border bg-secondary flex items-center justify-center text-3xl font-bold gum-shadow overflow-hidden cursor-pointer hover:opacity-90 transition-opacity outline-none">
                                                {profile.avatar_url ? (
                                                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                                                ) : initials}
                                            </div>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-[90vw] max-h-[90vh] p-8 border-none bg-transparent shadow-none flex items-center justify-center">
                                            <div className="relative group">
                                                {profile.avatar_url ? (
                                                    <img
                                                        src={profile.avatar_url}
                                                        alt={profile.username}
                                                        className="max-w-full max-h-[80vh] rounded-[px] gum-border gum-shadow object-contain"
                                                    />
                                                ) : (
                                                    <div className="w-48 h-48 rounded-[3px] gum-border bg-secondary flex items-center justify-center text-6xl font-bold gum-shadow">
                                                        {initials}
                                                    </div>
                                                )}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>

                                <div className="flex justify-end pt-4">
                                    {isOwnProfile ? (
                                        <EditProfileDialog
                                            currentProfile={{
                                                display_name: profile.display_name,
                                                bio: profile.bio,
                                                avatar_url: profile.avatar_url,
                                                banner_url: profile.banner_url
                                            }}
                                            onUpdate={fetchData}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(`/whisper/${profile.username}`)}
                                                className="p-2.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-all gum-border"
                                                title="Whisper"
                                            >
                                                <Send size={18} />
                                            </button>
                                            <button
                                                onClick={toggleFollow}
                                                className={`gum-btn text-sm px-6 ${isFollowing ? 'bg-secondary' : 'bg-primary text-primary-foreground'}`}
                                            >
                                                {isFollowing ? 'Following' : 'Follow'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8">
                                    <h1 className="text-2xl font-bold tracking-tight">{profile.display_name}</h1>
                                    <p className="text-muted-foreground">@{profile.username}</p>
                                </div>

                                <p className="mt-4 text-sm leading-relaxed max-w-xl">
                                    {profile.bio || "No bio yet."}
                                </p>

                                <div className="flex flex-wrap gap-4 mt-6 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={16} />
                                        <span>Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                                    </div>
                                </div>

                                <div className="flex gap-6 mt-6">
                                    <button
                                        onClick={() => {
                                            setFollowsModalType("following");
                                            setFollowsModalOpen(true);
                                        }}
                                        className="hover:underline flex items-center gap-1.5"
                                    >
                                        <span className="font-bold text-foreground">{stats.following}</span>
                                        <span className="text-muted-foreground text-sm">Following</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFollowsModalType("followers");
                                            setFollowsModalOpen(true);
                                        }}
                                        className="hover:underline flex items-center gap-1.5"
                                    >
                                        <span className="font-bold text-foreground">{stats.followers}</span>
                                        <span className="text-muted-foreground text-sm">Followers</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h2 className="font-bold text-lg px-2">Posts</h2>
                            {posts.length === 0 ? (
                                <div className="gum-card p-12 text-center text-muted-foreground text-sm">
                                    No posts yet.
                                </div>
                            ) : (
                                posts.map(post => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        onLike={handleLike}
                                        onBookmark={handleBookmark}
                                        onDelete={handleDelete}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="hidden lg:block">
                        <Sidebar />
                    </div>
                </div>
            </main>

            {profile && (
                <FollowsList
                    userId={profile.user_id}
                    type={followsModalType}
                    isOpen={followsModalOpen}
                    onOpenChange={setFollowsModalOpen}
                    onAction={refreshFollows}
                />
            )}
        </div>
    );
};

export default ProfilePage;
