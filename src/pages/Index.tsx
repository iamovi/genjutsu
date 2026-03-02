import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import ComposePost from "@/components/ComposePost";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { usePosts } from "@/hooks/usePosts";
import { Code, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { posts, loading: postsLoading, createPost, toggleLike, toggleBookmark, deletePost } = usePosts();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>genjutsu — everything vanishes.</title>
        <meta name="description" content="Share your code and thoughts on genjutsu. Everything disappears after 24 hours. No archives, no regrets." />
        <meta property="og:title" content="genjutsu — 24 Hour Social Media" />
        <meta property="og:description" content="The social network where everything is temporary. 24 hours only. Share code & connect." />
        <meta property="og:image" content="/fav.jpg" />
      </Helmet>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div>
            {user ? (
              <ComposePost onPost={createPost} />
            ) : (
              <div className="gum-card p-6 mb-6 text-center">
                <div className="w-12 h-12 rounded-xl overflow-hidden gum-border mx-auto mb-3">
                  <img src="/fav.jpg" alt="genjutsu" className="w-full h-full object-cover" />
                </div>
                <h2 className="font-bold text-lg mb-1">Join the conversation</h2>
                <p className="text-sm text-muted-foreground mb-4">Sign in to share what you're building</p>
                <button
                  onClick={() => navigate("/auth")}
                  className="gum-btn bg-primary text-primary-foreground text-sm"
                >
                  Get Started
                </button>
              </div>
            )}

            {postsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : posts.length === 0 ? (
              <div className="gum-card p-8 text-center">
                <p className="text-muted-foreground text-sm">No posts yet. Be the first to share something!</p>
              </div>
            ) : (
              <div className="space-y-0">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={toggleLike}
                    onBookmark={toggleBookmark}
                    onDelete={deletePost}
                  />
                ))}
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

export default Index;
