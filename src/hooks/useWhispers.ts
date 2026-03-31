import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect, useState, useCallback, useRef } from "react";
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
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const channelRef = useRef<any>(null);
    const isSubscribedRef = useRef(false);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Broadcast typing status
    const setTyping = useCallback((typing: boolean) => {
        if (channelRef.current && isSubscribedRef.current && targetUserId && user) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user.id, typing, targetId: targetUserId },
            });
        }
    }, [targetUserId, user]);

    // Realtime subscription — listen for messages AND typing events
    useEffect(() => {
        if (!user) return;

        let cancelled = false;
        let typingTimeout: NodeJS.Timeout;

        // Small delay to avoid StrictMode double-mount WebSocket churn
        const timer = setTimeout(() => {
            if (cancelled) return;

            const channelId = targetUserId 
                ? `whispers-rt-${[user.id, targetUserId].sort().join('-')}`
                : `whispers-global-rt-${user.id}`;

            const channel = sb.channel(channelId);
            channelRef.current = channel;

            channel
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "messages",
                        filter: `receiver_id=eq.${user.id}`,
                    },
                    (payload: any) => {
                        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
                        if (targetUserId && payload.new.sender_id === targetUserId) {
                            markRead(targetUserId);
                            queryClient.invalidateQueries({ queryKey: ["whispers", user.id, targetUserId] });
                            // When we get a message, they've definitely stopped typing
                            setIsOtherUserTyping(false);
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
                        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
                        if (targetUserId) {
                            queryClient.invalidateQueries({ queryKey: ["whispers", user.id, targetUserId] });
                        }
                    }
                )
                .on("broadcast", { event: "typing" }, (payload: any) => {
                    if (targetUserId && payload.payload.userId === targetUserId && payload.payload.targetId === user.id) {
                        setIsOtherUserTyping(payload.payload.typing);
                        
                        // Safety timeout: if they stop sending typing events, hide it after 5 seconds
                        if (payload.payload.typing) {
                            clearTimeout(typingTimeout);
                            typingTimeout = setTimeout(() => setIsOtherUserTyping(false), 5000);
                        }
                    }
                })
                .subscribe((status: string) => {
                     if (status === 'SUBSCRIBED') {
                         isSubscribedRef.current = true;
                     } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                         isSubscribedRef.current = false;
                     }
                });
        }, 100);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            if (typingTimeout) clearTimeout(typingTimeout);
            
            if (channelRef.current) {
                const chan = channelRef.current;
                channelRef.current = null;
                
                // Safe cleanup: Only attempt to remove if it actually finished connecting
                // This prevents the 'WebSocket is closed before connection is established' error
                const state = chan.state;
                if (state === 'joined' || state === 'joining') {
                     // Supabase handles unsubscribe cleanly
                     chan.unsubscribe().then(() => {
                         sb.removeChannel(chan).catch(() => {});
                     }).catch(() => {});
                } else {
                     sb.removeChannel(chan).catch(() => {});
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setTyping,
        isOtherUserTyping,
    };
}
