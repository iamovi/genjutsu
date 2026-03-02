import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect } from "react";

export interface Whisper {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    sender_profile?: {
        username: string;
        display_name: string;
        avatar_url: string | null;
    };
}

export interface Conversation {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    last_message: string;
    last_message_at: string;
}

export function useWhispers(targetUserId?: string) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const sb = supabase as any;

    // Fetch all conversations (list of people)
    const { data: conversations, isLoading: loadingConversations } = useQuery({
        queryKey: ["conversations", user?.id],
        queryFn: async () => {
            if (!user) return [];

            const { data, error } = await sb.from("messages")
                .select("sender_id, receiver_id, content, created_at")
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false });

            if (error) throw error;
            if (!data) return [];

            // Group by user and find last message
            const groups: Record<string, any> = {};
            const otherUserIds: string[] = [];

            (data as any[]).forEach((msg: any) => {
                const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
                if (!groups[otherId]) {
                    groups[otherId] = {
                        last_message: msg.content,
                        last_message_at: msg.created_at,
                    };
                    otherUserIds.push(otherId);
                }
            });

            if (otherUserIds.length === 0) return [];

            const { data: profiles } = await sb
                .from("profiles")
                .select("user_id, username, display_name, avatar_url")
                .in("user_id", otherUserIds);

            return (profiles || []).map(p => ({
                ...p,
                ...groups[p.user_id]
            })) as Conversation[];
        },
        enabled: !!user,
    });

    // Fetch messages with a specific user
    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ["whispers", user?.id, targetUserId],
        queryFn: async () => {
            if (!user || !targetUserId) return [];

            const { data, error } = await sb.from("messages")
                .select("id, content, sender_id, receiver_id, created_at")
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
                .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: true });

            if (error) throw error;
            return (data as any) as Whisper[];
        },
        enabled: !!user && !!targetUserId,
    });

    // Send message
    const sendMessageMutation = useMutation({
        mutationFn: async (content: string) => {
            if (!user || !targetUserId) throw new Error("Not authenticated");
            const { error } = await sb.from("messages").insert({
                sender_id: user.id,
                receiver_id: targetUserId,
                content: content.trim(),
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whispers", user?.id, targetUserId] });
            queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
        },
        onError: (err: any) => {
            toast.error("Failed to send whisper: " + err.message);
        }
    });

    // Realtime subscription
    useEffect(() => {
        if (!user) return;

        const channel = sb
            .channel("whispers-changes")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `receiver_id=eq.${user.id}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
                    if (targetUserId) {
                        queryClient.invalidateQueries({ queryKey: ["whispers", user?.id, targetUserId] });
                    }
                }
            )
            .subscribe();

        return () => {
            sb.removeChannel(channel);
        };
    }, [user, targetUserId, queryClient, sb]);

    return {
        conversations,
        loadingConversations,
        messages,
        loadingMessages,
        sendMessage: sendMessageMutation.mutateAsync,
        isSending: sendMessageMutation.isPending,
    };
}
