import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export interface NotificationWithActor {
    id: string;
    user_id: string;
    actor_id: string;
    type: "like" | "unlike" | "comment" | "uncomment" | "follow" | "unfollow" | "mention";
    post_id: string | null;
    comment_id: string | null;
    is_read: boolean;
    created_at: string;
    actor_profile: {
        username: string;
        display_name: string;
        avatar_url: string | null;
    } | null;
}

export function useNotifications() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const sb = supabase as any;

    // Fetch notifications with actor profiles.
    // Note: actor_id FK points to auth.users (not profiles), so PostgREST
    // embedded selects can't resolve profiles through it. We fetch notifications
    // first, then batch-fetch unique actor profiles in one additional query.
    const { data: notifications, isLoading } = useQuery({
        queryKey: ["notifications", user?.id],
        queryFn: async () => {
            if (!user) return [];

            const { data, error } = await sb
                .from("notifications")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) throw error;
            if (!data || data.length === 0) return [];

            // Batch-fetch unique actor profiles in one query
            const actorIds = [...new Set((data as any[]).map((n: any) => n.actor_id))];
            const { data: profiles } = await sb
                .from("profiles")
                .select("user_id, username, display_name, avatar_url")
                .in("user_id", actorIds);

            const profileMap: Record<string, any> = {};
            (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

            return (data as any[]).map((n: any) => ({
                ...n,
                actor_profile: profileMap[n.actor_id] || null,
            })) as NotificationWithActor[];
        },
        enabled: !!user,
        staleTime: 30_000,           // Don't re-fetch for 30s
        refetchOnWindowFocus: false,  // Tab switches don't trigger a DB re-fetch
    });

    // Unread count
    const unreadCount = (notifications || []).filter(n => !n.is_read).length;

    // Mark single notification as read
    const markAsReadMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            if (!user) return;
            const { error } = await sb
                .from("notifications")
                .update({ is_read: true })
                .eq("id", notificationId)
                .eq("user_id", user.id);
            if (error) throw error;
        },
        onMutate: async (notificationId: string) => {
            await queryClient.cancelQueries({ queryKey: ["notifications"] });
            queryClient.setQueryData(
                ["notifications", user?.id],
                (old: NotificationWithActor[] | undefined) =>
                    (old || []).map(n =>
                        n.id === notificationId ? { ...n, is_read: true } : n
                    )
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    // Mark all as read
    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            if (!user) return;
            const { error } = await sb
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", user.id)
                .eq("is_read", false);
            if (error) throw error;
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ["notifications"] });
            queryClient.setQueryData(
                ["notifications", user?.id],
                (old: NotificationWithActor[] | undefined) =>
                    (old || []).map(n => ({ ...n, is_read: true }))
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    // Realtime subscription for new notifications
    useEffect(() => {
        if (!user) return;

        let channel: any = null;
        let cancelled = false;

        const timer = setTimeout(() => {
            if (cancelled) return;

            channel = sb
                .channel(`notifications-rt-${user.id}-${Date.now()}`)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "notifications",
                        filter: `user_id=eq.${user.id}`,
                    },
                    () => {
                        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
                    }
                )
                .subscribe();
        }, 100);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            if (channel) {
                channel.unsubscribe();
                sb.removeChannel(channel).catch(() => { });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, queryClient]);

    return {
        notifications: notifications || [],
        unreadCount,
        isLoading,
        markAsRead: (id: string) => markAsReadMutation.mutate(id),
        markAllAsRead: () => markAllAsReadMutation.mutate(),
    };
}
