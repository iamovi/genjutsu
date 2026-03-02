import { Users, Loader2, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { useNavigate, Link } from "react-router-dom";

interface SuggestedProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  is_following?: boolean;
}

interface SidebarProps {
  onAction?: () => void;
}

const Sidebar = ({ onAction }: SidebarProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggestedDevs, setSuggestedDevs] = useState<SuggestedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const [trendingTags, setTrendingTags] = useState<{ tag: string, count: number }[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from("profiles")
          .select("*")
          .limit(10);

        if (user) {
          query = query.neq("user_id", user.id);
        }

        const { data: profiles, error: profilesError } = await query;
        if (profilesError) throw profilesError;

        if (user && profiles) {
          const { data: follows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);

          const followedSet = new Set((follows || []).map(f => f.following_id));
          setFollowingIds(followedSet);

          const notFollowed = (profiles as SuggestedProfile[])
            .filter(p => !followedSet.has(p.user_id));

          setSuggestedDevs(notFollowed.slice(0, 3));
        } else {
          setSuggestedDevs((profiles as SuggestedProfile[] || []).slice(0, 3));
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchTrending = async () => {
      try {
        const { data: posts } = await supabase
          .from("posts")
          .select("tags")
          .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (posts) {
          const counts: Record<string, number> = {};
          posts.forEach(p => {
            (p.tags || []).forEach((t: string) => {
              counts[t] = (counts[t] || 0) + 1;
            });
          });
          const sorted = Object.entries(counts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          setTrendingTags(sorted);
        }
      } catch (error) {
        console.error("Trending fetch error:", error);
      }
    };

    fetchSuggestions();
    fetchTrending();
  }, [user]);

  // ... handleFollow

  const handleFollow = async (targetUserId: string) => {
    if (!user) {
      toast.error("Please sign in to follow users");
      return;
    }

    try {
      const isFollowing = followingIds.has(targetUserId);

      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);

        if (error) throw error;

        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        toast.success("Unfollowed user");
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });

        if (error) throw error;

        setFollowingIds(prev => new Set(prev).add(targetUserId));
        toast.success("Following user");
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("Failed to update follow status");
    }
  };

  return (
    <aside className="space-y-4">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="gum-card p-4"
      >
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
          <Users size={16} />
          Who to follow
        </h3>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {suggestedDevs.length > 0 ? (
                suggestedDevs.map((dev) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={dev.user_id}
                    className="flex items-center gap-3"
                  >
                    <button
                      onClick={() => { navigate(`/${dev.username}`); onAction?.(); }}
                      className="w-9 h-9 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden hover:opacity-80 transition-opacity"
                    >
                      {dev.avatar_url ? (
                        <img src={dev.avatar_url} alt={dev.username} className="w-full h-full object-cover" />
                      ) : (
                        dev.display_name.substring(0, 2).toUpperCase()
                      )}
                    </button>
                    <button
                      onClick={() => { navigate(`/${dev.username}`); onAction?.(); }}
                      className="flex-1 min-w-0 text-left group"
                    >
                      <p className="text-sm font-bold truncate group-hover:underline">{dev.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{dev.username}</p>
                    </button>
                    <button
                      onClick={() => handleFollow(dev.user_id)}
                      className={`gum-btn text-[11px] px-3 py-1.5 transition-colors ${followingIds.has(dev.user_id)
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary text-primary-foreground"
                        }`}
                    >
                      {followingIds.has(dev.user_id) ? "Following" : "Follow"}
                    </button>
                  </motion.div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">No suggestions found</p>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.25 }}
        className="gum-card p-4"
      >
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
          <Hash size={16} />
          Trending
        </h3>
        <div className="space-y-3">
          {trendingTags.length > 0 ? (
            trendingTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => { navigate(`/search?q=${encodeURIComponent('#' + tag)}`); onAction?.(); }}
                className="block w-full text-left group"
              >
                <p className="text-sm font-bold group-hover:underline">#{tag}</p>
                <p className="text-[10px] text-muted-foreground">{count} echoes in 24h</p>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground py-2 text-center italic">The abyss is quiet...</p>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xs text-muted-foreground space-y-1 px-1"
      >
        <p>© 2026 genjutsu · Created by <a href="https://iamovi.github.io/" target="_blank" rel="noopener noreferrer" className="hover:underline text-primary/80 font-bold">Ovi</a></p>
        <div className="flex gap-3">
          <Link to="/about" onClick={() => onAction?.()} className="hover:underline">About</Link>
          <Link to="/terms" onClick={() => onAction?.()} className="hover:underline">Terms</Link>
          <Link to="/privacy" onClick={() => onAction?.()} className="hover:underline">Privacy</Link>
        </div>
      </motion.div>
    </aside>
  );
};

export default Sidebar;

