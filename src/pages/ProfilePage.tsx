import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostWithProfile } from "@/hooks/usePosts";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import { Loader2, ArrowLeft, Calendar, ImageIcon, Send, Bookmark, Github, Twitter, Facebook, Globe, Play, Pause, Ban } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import EditProfileDialog from "@/components/EditProfileDialog";
import FollowsList from "@/components/FollowsList";
import { PostSkeleton } from "@/components/ui/skeleton";
import { getNow } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";

import { useFollow } from "@/hooks/useFollow";
import { usePostActions } from "@/hooks/usePostActions";
import { linkify } from "@/lib/linkify";

interface ProfileData {
    id: string;
    user_id: string;
    username: string;
    display_name: string;
    bio: string;
    avatar_url: string;
    banner_url: string;
    social_links?: Record<string, string>;
    fav_song?: any;
    created_at: string;
    banned_until?: string | null;
}

const ProfilePage = () => {
    const { username } = useParams<{ username: string }>();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [posts, setPosts] = useState<PostWithProfile[]>([]);
    const [bookmarks, setBookmarks] = useState<PostWithProfile[]>([]);
    const [isLiking, setIsLiking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const togglePlay = () => {
        if (!profile?.fav_song?.previewUrl) return;

        if (!audioRef.current) {
            audioRef.current = new Audio(profile.fav_song.previewUrl);
            audioRef.current.addEventListener('timeupdate', () => {
                if (audioRef.current) {
                    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
                }
            });
            audioRef.current.addEventListener('ended', () => {
                setIsPlaying(false);
                setProgress(0);
            });
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setIsPlaying(false);
            setProgress(0);
        }
    }, [profile?.fav_song?.previewUrl]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"posts" | "bookmarks">("posts");

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
                .select("*, banned_until")
                .eq("username", username.toLowerCase())
                .single();

            if (pError) throw pError;
            if (!p) throw new Error("Profile not found");
            setProfile(p as unknown as ProfileData);

            // 2. Fetch Posts
            const { data: postsData } = await (supabase
                .from("posts")
                .select(`
                  id, content, code, media_url, tags, created_at, user_id, is_readme,
                  profiles ( username, display_name, avatar_url )
                `) as any)
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
                .eq("user_id", (p as any).user_id)
                .order("created_at", { ascending: false });

            if (postsData && p) {
                const postIds = (postsData as any[]).map(post => post.id);

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
    }, [username, user?.id]);

    // Fetch bookmarked posts (only for own profile)
    const fetchBookmarks = async () => {
        if (!user || !profile || user.id !== profile.user_id) return;

        try {
            const { data: bookmarkRows } = await supabase
                .from("bookmarks")
                .select("post_id")
                .eq("user_id", user.id);

            if (!bookmarkRows || bookmarkRows.length === 0) {
                setBookmarks([]);
                return;
            }

            const postIds = bookmarkRows.map((b: any) => b.post_id);

            const { data: postsData } = await (supabase
                .from("posts")
                .select(`
                    id, content, code, media_url, tags, created_at, user_id, is_readme,
                    profiles ( username, display_name, avatar_url )
                `) as any)
                .in("id", postIds)
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false });

            if (!postsData || postsData.length === 0) {
                setBookmarks([]);
                return;
            }

            const activePostIds = (postsData as any[]).map(p => p.id);

            const [{ data: likesData }, { data: commentsData }] = await Promise.all([
                supabase.from("likes").select("post_id").in("post_id", activePostIds),
                supabase.from("comments").select("post_id").in("post_id", activePostIds),
            ]);

            const likesCounts: Record<string, number> = {};
            (likesData || []).forEach((l: any) => {
                likesCounts[l.post_id] = (likesCounts[l.post_id] || 0) + 1;
            });

            const commentsCounts: Record<string, number> = {};
            (commentsData || []).forEach((c: any) => {
                commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
            });

            const [{ data: myLikes }] = await Promise.all([
                supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", activePostIds),
            ]);
            const userLikes = new Set((myLikes || []).map((l: any) => l.post_id));

            const enriched = postsData.map(post => ({
                ...post,
                profiles: post.profiles as any,
                likes_count: likesCounts[post.id] || 0,
                user_liked: userLikes.has(post.id),
                user_bookmarked: true,
                comments_count: commentsCounts[post.id] || 0
            } as PostWithProfile));

            setBookmarks(enriched);
        } catch (err) {
            console.error("Error fetching bookmarks:", err);
        }
    };

    useEffect(() => {
        if (activeTab === "bookmarks" && profile && user?.id === profile.user_id) {
            fetchBookmarks();
        }
    }, [activeTab, profile?.user_id, user?.id]);

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
        // Local state sync for posts
        setPosts((prev) =>
            prev.map((p) => {
                if (p.id === postId) {
                    return { ...p, user_bookmarked: !currentlyBookmarked };
                }
                return p;
            })
        );
        // If unbookmarking, instantly remove from bookmarks list
        if (currentlyBookmarked) {
            setBookmarks((prev) => prev.filter((p) => p.id !== postId));
        } else {
            // If bookmarking, update the bookmark state in bookmarks list too
            setBookmarks((prev) =>
                prev.map((p) => p.id === postId ? { ...p, user_bookmarked: true } : p)
            );
        }
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

    const initials = profile?.display_name?.substring(0, 2).toUpperCase() || "??";
    const isOwnProfile = user?.id === profile?.user_id;

    return (
        <div className="min-h-screen bg-background text-foreground">
            {profile && (
                <Helmet>
                    <title>{profile.display_name} (u/{profile.username}) — genjutsu</title>
                    <meta name="description" content={profile.bio || `Check out ${profile.display_name}'s profile on genjutsu.`} />
                    <meta property="og:title" content={`${profile.display_name} (u/${profile.username}) — genjutsu`} />
                    <meta property="og:description" content={profile.bio || `Check out ${profile.display_name}'s profile on genjutsu.`} />
                    <meta property="og:image" content={profile.avatar_url || "/fav.jpg"} />
                </Helmet>
            )}
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
                    <div className="space-y-4">
                        {loading ? (
                            <div className="space-y-6">
                                <PostSkeleton />
                                <PostSkeleton />
                                <PostSkeleton />
                            </div>
                        ) : !profile ? (
                            <div className="gum-card p-12 text-center text-muted-foreground">
                                Profile not found.
                            </div>
                        ) : (
                            <>
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
                                                    <DialogTitle className="sr-only">Avatar Preview</DialogTitle>
                                                    <DialogDescription className="sr-only">Full size view of {profile.display_name}'s avatar</DialogDescription>
                                                    <div className="relative group">
                                                        {profile.avatar_url ? (
                                                            <img
                                                                src={profile.avatar_url}
                                                                alt={profile.username}
                                                                className="max-w-full max-h-[80vh] rounded-[3px] gum-border gum-shadow object-contain"
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
                                                        banner_url: profile.banner_url,
                                                        social_links: profile.social_links,
                                                        fav_song: profile.fav_song
                                                    }}
                                                    onUpdate={fetchData}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (!user) {
                                                                toast.error("Please sign in to send messages");
                                                                return;
                                                            }
                                                            navigate(`/whisper/${profile.username}`);
                                                        }}
                                                        className="p-2 gum-card bg-secondary text-muted-foreground hover:text-primary transition-colors"
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

                                        {isOwnProfile && profile.banned_until && new Date(profile.banned_until) > getNow() && (
                                            <div className="mt-8 mb-4">
                                                <div className="bg-destructive/10 border-2 border-destructive/20 rounded-[3px] p-4 flex items-start gap-3">
                                                    <div className="bg-destructive text-destructive-foreground p-1.5 rounded-sm shrink-0">
                                                        <Ban size={18} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-destructive">Account Restricted</h3>
                                                        <p className="text-xs text-destructive/80 mt-1">
                                                            You are temporarily banned from posting and commenting until <strong>{new Date(profile.banned_until).toLocaleString()}</strong>.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className={`min-w-0 max-w-full overflow-hidden ${!(isOwnProfile && profile.banned_until && new Date(profile.banned_until) > getNow()) ? 'mt-8' : ''}`}>
                                            <h1 className="text-2xl font-bold tracking-tight truncate">
                                                {profile.display_name}
                                            </h1>
                                            <p className="text-muted-foreground truncate">u/{profile.username}</p>
                                        </div>

                                        <p className="mt-4 text-sm leading-relaxed max-w-xl whitespace-pre-wrap">
                                            {profile.bio ? linkify(profile.bio) : "No bio yet."}
                                        </p>

                                        {profile.social_links && Object.values(profile.social_links).some(link => link) && (
                                            <div className="flex flex-wrap gap-3 mt-4">
                                                {Object.entries(profile.social_links).map(([platform, link]) => {
                                                    if (!link) return null;

                                                    const formattedLink = link.startsWith('http') ? link : `https://${link}`;
                                                    const icons: Record<string, any> = {
                                                        github: Github,
                                                        twitter: Twitter,
                                                        facebook: Facebook,
                                                        website: Globe
                                                    };
                                                    const Icon = icons[platform] || Globe;

                                                    return (
                                                        <a
                                                            key={platform}
                                                            href={formattedLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 gum-card bg-secondary/50 text-muted-foreground hover:text-primary hover:bg-secondary transition-all hover:scale-110 active:scale-95"
                                                            title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                                                        >
                                                            <Icon size={18} />
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {profile.fav_song && (
                                            <div className="mt-6">
                                                <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-background border-2 border-foreground rounded-[3px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in fade-in slide-in-from-top-4 duration-500">
                                                    <div className="relative group shrink-0">
                                                        <img
                                                            src={profile.fav_song.artworkUrl100}
                                                            className="w-10 h-10 rounded-[3px] object-cover border-2 border-foreground animate-spin-slow"
                                                            style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                                                            alt=""
                                                        />
                                                        <button
                                                            onClick={togglePlay}
                                                            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[3px] opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                                        >
                                                            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex gap-1 items-end h-3 mb-1.5">
                                                            {[1, 2, 3, 4, 5].map(i => (
                                                                <div
                                                                    key={i}
                                                                    className={`w-1 bg-foreground rounded-full transition-all duration-300 ${isPlaying ? 'animate-music-bar' : 'h-1'}`}
                                                                    style={{ animationDelay: `${i * 0.15}s` }}
                                                                />
                                                            ))}
                                                        </div>
                                                        <p className="text-xs font-black truncate max-w-[250px] leading-tight flex items-center gap-1.5">
                                                            {profile.fav_song.trackName}
                                                            <span className="w-1 h-1 rounded-full bg-foreground/20" />
                                                            <span className="opacity-60 font-medium">{profile.fav_song.artistName}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

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
                                    {isOwnProfile ? (
                                        <div className="flex gap-2 border-b border-border pb-px mb-4">
                                            {(["posts", "bookmarks"] as const).map((tab) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setActiveTab(tab)}
                                                    className={`px-6 py-2.5 text-sm font-bold capitalize transition-all relative flex items-center gap-2 ${activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                                                >
                                                    {tab === "bookmarks" && <Bookmark size={14} />}
                                                    {tab}
                                                    {activeTab === tab && (
                                                        <motion.div
                                                            layoutId="profileTab"
                                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                                        />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <h2 className="font-bold text-lg px-2">Posts</h2>
                                    )}

                                    {activeTab === "posts" ? (
                                        posts.length === 0 ? (
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
                                        )
                                    ) : (
                                        bookmarks.length === 0 ? (
                                            <div className="gum-card p-12 text-center flex flex-col items-center gap-4 bg-secondary/20 border-dashed">
                                                <div className="w-16 h-16 rounded-[3px] bg-secondary flex items-center justify-center border-2 border-primary/20">
                                                    <Bookmark size={32} className="text-primary/50" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg">No bookmarks yet</h3>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        Save posts to find them later. Bookmarked posts still vanish after 24 hours.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            bookmarks.map(post => (
                                                <PostCard
                                                    key={post.id}
                                                    post={post}
                                                    onLike={handleLike}
                                                    onBookmark={handleBookmark}
                                                    onDelete={handleDelete}
                                                />
                                            ))
                                        )
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="hidden lg:block lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 custom-scrollbar">
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
