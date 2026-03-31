import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getNow } from "@/lib/utils";

export function useUnreadWhispers() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const sb = supabase as any;

    // Query: count of unread received messages (within 24h window)
    const { data: hasUnread = false } = useQuery({
        queryKey: ["whisper-unread", user?.id],
        queryFn: async () => {
            if (!user) return false;

            const { count, error } = await sb
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("receiver_id", user.id)
                .eq("is_read", false)
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString());

            if (error) return false;
            return (count || 0) > 0;
        },
        enabled: !!user,
    });

    // Realtime: instant dot when new message arrives
    useEffect(() => {
        if (!user) return;

        let channel: any = null;
        let cancelled = false;

        const timer = setTimeout(() => {
            if (cancelled) return;

            channel = sb
                .channel(`whisper-unread-${user.id}-${getNow().getTime()}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "messages",
                        filter: `receiver_id=eq.${user.id}`,
                    },
                    () => {
                        // Refresh the unread dot query - it will see the most accurate state
                        // (including if a message was just marked read by useWhispers)
                        queryClient.invalidateQueries({ queryKey: ["whisper-unread", user.id] });
                        // Always refresh conversations to show bold/new messages
                        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
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
    }, [user?.id]);

    return { hasUnread };
}
