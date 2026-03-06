import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useFollow(targetUserId?: string) {
    const { user } = useAuth();
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ followers: 0, following: 0 });

    const fetchFollowStatus = useCallback(async () => {
        if (!targetUserId) return;

        try {
            if (user) {
                const { data } = await supabase
                    .from("follows")
                    .select("id")
                    .eq("follower_id", user.id)
                    .eq("following_id", targetUserId)
                    .maybeSingle();
                setIsFollowing(!!data);
            }
        } catch (err) {
            console.error("Error fetching follow status:", err);
        }
    }, [user, targetUserId]);

    const fetchStats = useCallback(async () => {
        if (!targetUserId) return;

        try {
            const [followersCount, followingCount] = await Promise.all([
                supabase.from("follows").select("id", { count: 'exact', head: true }).eq("following_id", targetUserId),
                supabase.from("follows").select("id", { count: 'exact', head: true }).eq("follower_id", targetUserId)
            ]);

            setStats({
                followers: followersCount.count || 0,
                following: followingCount.count || 0
            });
        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    }, [targetUserId]);

    useEffect(() => {
        fetchFollowStatus();
        fetchStats();
    }, [fetchFollowStatus, fetchStats]);

    const toggleFollow = async () => {
        if (!user) {
            toast.error("Please sign in to follow users");
            return;
        }

        if (!targetUserId) return;
        if (user.id === targetUserId) return;

        const originalFollowing = isFollowing;
        const originalFollowersCount = stats.followers;

        // Optimistic Update
        setIsFollowing(!originalFollowing);
        setStats(prev => ({
            ...prev,
            followers: originalFollowing ? prev.followers - 1 : prev.followers + 1
        }));

        try {
            if (originalFollowing) {
                // Unfollow
                const { data, error } = await supabase
                    .from("follows")
                    .delete()
                    .eq("follower_id", user.id)
                    .eq("following_id", targetUserId)
                    .select();

                if (error) throw error;
                if (!data || data.length === 0) throw new Error("violates row-level security policy");
            } else {
                // Follow
                const { error } = await supabase
                    .from("follows")
                    .insert({
                        follower_id: user.id,
                        following_id: targetUserId
                    });

                if (error) throw error;
            }
        } catch (err: any) {
            // Revert on error
            setIsFollowing(originalFollowing);
            setStats(prev => ({
                ...prev,
                followers: originalFollowersCount
            }));
            const msg = err?.message || "";
            const code = err?.code;
            if (
                msg.includes("violates row-level security policy") ||
                msg.includes("permission denied") ||
                code === "PGRST301" ||
                code === "42501"
            ) {
                toast.error("You are banned from following or unfollowing users right now.");
            } else {
                toast.error(msg || "Failed to update follow status");
            }
        }
    };

    return { isFollowing, toggleFollow, stats, loading, refresh: () => { fetchFollowStatus(); fetchStats(); } };
}
