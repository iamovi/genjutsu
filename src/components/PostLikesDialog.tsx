import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PostLikesDialogProps {
  postId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LikeRow {
  user_id: string;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Liker {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  liked_at: string;
}

const PAGE_SIZE = 50;

export default function PostLikesDialog({ postId, isOpen, onOpenChange }: PostLikesDialogProps) {
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const navigate = useNavigate();

  const fetchLikersPage = useCallback(async (pageIndex: number, append: boolean) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: likesData, error: likesError } = await supabase
      .from("likes")
      .select("user_id, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (likesError) throw likesError;

    const likeRows = (likesData || []) as LikeRow[];
    if (likeRows.length === 0) {
      if (!append) setLikers([]);
      setHasMore(false);
      return;
    }

    const userIds = Array.from(new Set(likeRows.map((like) => like.user_id)));

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", userIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map(
      ((profilesData || []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
    );

    const merged = likeRows.map((like) => {
      const profile = profileMap.get(like.user_id);
      return {
        user_id: like.user_id,
        username: profile?.username || "unknown",
        display_name: profile?.display_name || "Unknown user",
        avatar_url: profile?.avatar_url || null,
        liked_at: like.created_at,
      };
    });

    setLikers((prev) => (append ? [...prev, ...merged] : merged));
    setPage(pageIndex);
    setHasMore(likeRows.length === PAGE_SIZE);
  }, [postId]);

  useEffect(() => {
    if (!isOpen || !postId) return;

    const fetchInitialPage = async () => {
      try {
        setLoading(true);
        setLoadingMore(false);
        setLikers([]);
        setPage(0);
        setHasMore(false);
        await fetchLikersPage(0, false);
      } catch (error) {
        console.error("Error fetching post likers:", error);
        toast.error("Couldn't load likes right now.");
      } finally {
        setLoading(false);
      }
    };

    void fetchInitialPage();
  }, [isOpen, postId, fetchLikersPage]);

  const handleLoadMore = async () => {
    if (loading || loadingMore || !hasMore) return;
    const fetchLikers = async () => {
      try {
        setLoadingMore(true);
        await fetchLikersPage(page + 1, true);
      } catch (error) {
        console.error("Error fetching post likers:", error);
        toast.error("Couldn't load likes right now.");
      } finally {
        setLoadingMore(false);
      }
    };

    void fetchLikers();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] gum-card border-2 border-foreground p-0 overflow-hidden max-h-[80vh] flex flex-col">
        <DialogHeader className="p-4 bg-secondary border-b-2 border-foreground">
          <DialogTitle className="text-lg font-bold">Liked By</DialogTitle>
          <DialogDescription className="sr-only">
            Users who liked this post
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <FrogLoader className="text-muted-foreground" size={24} />
            </div>
          ) : likers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No likes yet.
            </div>
          ) : (
            <div className="space-y-1">
              {likers.map((liker) => {
                const initials = liker.display_name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "?";

                return (
                  <button
                    key={`${liker.user_id}-${liker.liked_at}`}
                    type="button"
                    onClick={() => {
                      if (!liker.username || liker.username === "unknown") return;
                      onOpenChange(false);
                      navigate(`/u/${liker.username}`);
                    }}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-[3px] hover:bg-secondary transition-colors"
                  >
                    <div className="w-10 h-10 rounded-[3px] gum-border bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                      {liker.avatar_url ? (
                        <img src={liker.avatar_url} alt={liker.username} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{liker.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{liker.username}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(liker.liked_at), { addSuffix: true })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && hasMore && likers.length > 0 ? (
            <div className="pt-2 pb-1">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full gum-btn bg-secondary text-secondary-foreground text-xs h-9"
              >
                {loadingMore ? <FrogLoader size={14} className="" /> : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
