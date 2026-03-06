import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect } from "react";
import { getNow } from "@/lib/utils";

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
    has_unread: boolean;
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
                .select("sender_id, receiver_id, content, created_at, is_read")
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false });

            if (error) throw error;
            if (!data) return [];

            // Group by user and find last message
            const groups: Record<string, any> = {};
            const otherUserIds: string[] = [];
            const unreadByUser: Record<string, boolean> = {};

            (data as any[]).forEach((msg: any) => {
                const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
                if (!groups[otherId]) {
                    groups[otherId] = {
                        last_message: msg.content,
                        last_message_at: msg.created_at,
                    };
                    otherUserIds.push(otherId);
                }
                // Track unread: if I'm the receiver and is_read is false
                if (msg.receiver_id === user.id && !msg.is_read) {
                    unreadByUser[otherId] = true;
                }
            });

            if (otherUserIds.length === 0) return [];

            const { data: profiles } = await sb
                .from("profiles")
                .select("user_id, username, display_name, avatar_url")
                .in("user_id", otherUserIds);

            return (profiles || []).map(p => ({
                ...p,
                ...groups[p.user_id],
                has_unread: !!unreadByUser[p.user_id],
            })).sort((a, b) =>
                new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            ) as Conversation[];
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
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: true });

            if (error) throw error;
            return (data as any) as Whisper[];
        },
        enabled: !!user && !!targetUserId,
    });

    // Mark conversation as read
    const markRead = async (fromId: string) => {
        if (!user) return;
        const { error } = await sb
            .from("messages")
            .update({ is_read: true })
            .eq("sender_id", fromId)
            .eq("receiver_id", user.id)
            .eq("is_read", false);

        if (!error) {
            queryClient.invalidateQueries({ queryKey: ["whisper-unread", user.id] });
            queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
        }
    };

    // Mark as read when opening a chat
    useEffect(() => {
        if (targetUserId) {
            markRead(targetUserId);
        }
    }, [user?.id, targetUserId]);

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
            const msg = err?.message || "";
            if (msg.includes("violates row-level security policy") || msg.includes("permission denied")) {
                toast.error("You are banned from sending whispers right now.");
            } else {
                toast.error("Your whisper disappeared before it could be heard. Please try again.");
            }
        }
    });

    // Realtime subscription — listen for both incoming and outgoing messages
    useEffect(() => {
        if (!user) return;

        let channel: any = null;
        let cancelled = false;

        // Small delay to avoid StrictMode double-mount WebSocket churn
        const timer = setTimeout(() => {
            if (cancelled) return;

            channel = sb
                .channel(`whispers-rt-${user.id}-${getNow().getTime()}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "messages",
                        filter: `receiver_id=eq.${user.id}`,
                    },
                    (payload: any) => {
                        // Always refresh conversations list
                        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });

                        // If viewing a specific chat
                        if (targetUserId) {
                            // If message is from the person we are talking to, mark it read instantly
                            if (payload.new.sender_id === targetUserId) {
                                markRead(targetUserId);
                                queryClient.invalidateQueries({ queryKey: ["whispers", user.id, targetUserId] });
                            }
                        }
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "messages",
                        filter: `sender_id=eq.${user.id}`,
                    },
                    () => {
                        // Refresh conversations and current chat when WE send a message
                        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
                        if (targetUserId) {
                            queryClient.invalidateQueries({ queryKey: ["whispers", user.id, targetUserId] });
                        }
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
    }, [user?.id, targetUserId, queryClient]);

    return {
        conversations,
        loadingConversations,
        messages,
        loadingMessages,
        sendMessage: async (content: string) => {
            if (!user) {
                toast.error("You must be manifest to send a whisper. Please sign in.");
                return;
            }
            return sendMessageMutation.mutateAsync(content);
        },
        isSending: sendMessageMutation.isPending,
    };
}
