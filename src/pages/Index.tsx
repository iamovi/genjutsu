import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import ComposePost from "@/components/ComposePost";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { usePosts } from "@/hooks/usePosts";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { Helmet } from "react-helmet-async";
import { PostSkeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const {
    posts,
    loading: postsLoading,
    createPost,
    toggleLike,
    toggleBookmark,
    deletePost,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = usePosts();
  const navigate = useNavigate();
  const observerRef = useRef<HTMLDivElement>(null);
  const paginationRequestInFlightRef = useRef(false);

  useEffect(() => {
    paginationRequestInFlightRef.current = isFetchingNextPage;
  }, [isFetchingNextPage]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (paginationRequestInFlightRef.current) return;

        paginationRequestInFlightRef.current = true;
        void fetchNextPage().finally(() => {
          paginationRequestInFlightRef.current = false;
        });
      },
      {
        threshold: 0,
        rootMargin: "0px 0px 600px 0px",
      }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <FrogLoader className="" size={24} />
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
          <div className="min-w-0">
            {user ? (
              <ComposePost onPost={createPost} />
            ) : (
              <div className="gum-card p-6 mb-6 text-center">
                <div className="w-12 h-12 rounded-[3px] overflow-hidden gum-border mx-auto mb-3">
                  <img src="/fav.jpg" alt="genjutsu" className="w-full h-full object-cover" />
                </div>
                <h2 className="font-bold text-lg mb-1">{t("feed.joinConversation")}</h2>
                <p className="text-sm text-muted-foreground mb-4">{t("feed.signInToShare")}</p>
                <button
                  onClick={() => navigate("/auth")}
                  className="gum-btn bg-primary text-primary-foreground text-sm"
                >
                  {t("feed.getStarted")}
                </button>
              </div>
            )}

            {postsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="gum-card p-8 text-center border-dashed border-2">
                <p className="text-muted-foreground text-sm font-medium">{t("feed.noIllusions")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("feed.beTheFirst")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={toggleLike}
                    onBookmark={toggleBookmark}
                    onDelete={deletePost}
                  />
                ))}

                {isFetchingNextPage && (
                  <div className="space-y-4" aria-hidden="true">
                    {[1, 2].map((i) => (
                      <PostSkeleton key={`next-page-skeleton-${i}`} />
                    ))}
                  </div>
                )}

                <div ref={observerRef} className="h-10 flex justify-center items-center">
                  {isFetchingNextPage && <FrogLoader className=" text-muted-foreground" size={20} />}
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

export default Index;
