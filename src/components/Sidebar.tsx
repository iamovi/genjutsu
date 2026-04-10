import { Users, Hash, Bug, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useNavigate, Link, useLocation } from "react-router-dom";
import { getNow } from "@/lib/utils";

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
  const location = useLocation();
  const { t } = useTranslation();
  const isHome = location.pathname === "/";
  const [suggestedDevs, setSuggestedDevs] = useState<SuggestedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  // Use TanStack Query for trending tags
  const { data: rawTrendingTags, isLoading: isLoadingTrending } = useQuery({
    queryKey: ["trending-tags"],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from("posts")
        .select("tags")
        .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      if (!posts) return [];

      const counts: Record<string, number> = {};
      posts.forEach(p => {
        (p.tags || []).forEach((t: string) => {
          counts[t] = (counts[t] || 0) + 1;
        });
      });

      return Object.entries(counts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes (cache for performance)
    enabled: isHome, // Only fetch for the home feed
  });
  const trendingTags = rawTrendingTags ?? [];

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!isHome) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        let query = supabase
          .from("profiles")
          .select("*")
          .limit(30);

        if (user) {
          query = query.neq("user_id", user.id);
        }

        const { data: profiles, error: profilesError } = await query;
        if (profilesError) throw profilesError;

        if (profiles) {
          let candidates = profiles as SuggestedProfile[];

          if (user) {
            const { data: follows } = await supabase
              .from("follows")
              .select("following_id")
              .eq("follower_id", user.id);

            const followedSet = new Set((follows || []).map(f => f.following_id));
            setFollowingIds(followedSet);
            candidates = candidates.filter(p => !followedSet.has(p.user_id));
          }

          // Randomize and pick 3
          const shuffled = [...candidates].sort(() => 0.5 - Math.random());
          setSuggestedDevs(shuffled.slice(0, 3));
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [user, isHome]);

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
      {isHome && (
        <>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="gum-card p-4"
          >
            <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
              <Users size={16} />
              {t("sidebar.whoToFollow")}
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-[3px] gum-border bg-secondary shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 gum-border bg-secondary rounded-[3px] w-2/3"></div>
                      <div className="h-2 gum-border bg-secondary rounded-[3px] w-1/3"></div>
                    </div>
                    <div className="w-[68px] h-[26px] rounded-[3px] gum-border bg-secondary shrink-0"></div>
                  </div>
                ))}
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
                        className="flex items-center gap-3 min-w-0"
                      >
                        <button
                          onClick={() => { navigate(`/u/${dev.username}`); onAction?.(); }}
                          className="w-9 h-9 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden hover:opacity-80 transition-opacity"
                        >
                          {dev.avatar_url ? (
                            <img src={dev.avatar_url} alt={dev.username} className="w-full h-full object-cover" />
                          ) : (
                            dev.display_name.substring(0, 2).toUpperCase()
                          )}
                        </button>
                        <button
                          onClick={() => { navigate(`/u/${dev.username}`); onAction?.(); }}
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
                          {followingIds.has(dev.user_id) ? t("sidebar.following") : t("sidebar.follow")}
                        </button>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-2 text-center">{t("sidebar.noSuggestions")}</p>
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
              {t("sidebar.trending")}
            </h3>
            <div className="space-y-3">
              {isLoadingTrending ? (
                <div className="animate-pulse space-y-2 py-1">
                  <div className="h-3 gum-border bg-secondary rounded-[3px] w-1/2"></div>
                  <div className="h-2 gum-border bg-secondary rounded-[3px] w-1/3"></div>
                </div>
              ) : trendingTags.length > 0 ? (
                trendingTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => { navigate(`/search?q=${encodeURIComponent('#' + tag)}`); onAction?.(); }}
                    className="block w-full text-left group"
                  >
                    <p className="text-sm font-bold group-hover:underline">#{tag}</p>
                    <p className="text-[10px] text-muted-foreground">{count} {t("sidebar.echoesIn24h")}</p>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center italic">{t("sidebar.abyssQuiet")}</p>
              )}
            </div>
          </motion.div>
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="gum-card p-4 space-y-3"
      >
        <div className="flex justify-center items-center gap-1 text-xs font-bold uppercase tracking-wider">
          <Link to="/about" onClick={() => onAction?.()} className="hover:text-primary transition-colors px-1">{t("sidebar.about")}</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/terms" onClick={() => onAction?.()} className="hover:text-primary transition-colors px-1">{t("sidebar.terms")}</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/privacy" onClick={() => onAction?.()} className="hover:text-primary transition-colors px-1">{t("sidebar.privacy")}</Link>
        </div>
        <div className="flex justify-center items-center gap-2 text-[11px]">
          <a
            href={`https://github.com/iamovi/genjutsu/issues/new?template=bug_report.yml&title=${encodeURIComponent("[BUG]: ")}&environment=${encodeURIComponent(`- Page: ${window.location.href}\n- User Agent: ${navigator.userAgent}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction?.()}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors font-medium"
          >
            <Bug size={12} />
            {t("sidebar.reportBug")}
          </a>
          <span className="text-muted-foreground">·</span>
          <a
            href="https://github.com/iamovi/genjutsu/issues/new?template=feature_request.yml"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction?.()}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors font-medium"
          >
            <Lightbulb size={12} />
            {t("sidebar.requestFeature")}
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          {t("sidebar.copyright")}
        </p>
      </motion.div>
    </aside>
  );
};

export default Sidebar;
