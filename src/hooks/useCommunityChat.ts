import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect, useRef, useCallback, useState } from "react";
import { getNow } from "@/lib/utils";

export interface CommunityMessage {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    is_ai_reply?: boolean;
    profile?: {
        username: string;
        display_name: string;
        avatar_url: string | null;
    };
}

export function useCommunityChat() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const sb = supabase as any;
    const lastSentRef = useRef<number>(0);
    const [onlineCount, setOnlineCount] = useState(1);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const channelRef = useRef<any>(null);

    // Fetch messages from the last 24 hours
    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ["community-chat"],
        queryFn: async () => {
            const cutoff = new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString();

            const { data, error } = await sb
                .from("community_messages")
                .select("id, user_id, content, created_at, is_ai_reply")
                .gt("created_at", cutoff)
                .order("created_at", { ascending: true });

            if (error) throw error;
            if (!data || data.length === 0) return [];

            // Fetch profiles for all unique user_ids
            const userIds = [...new Set((data as any[]).map((m: any) => m.user_id))] as string[];
            const { data: profiles } = await sb
                .from("profiles")
                .select("user_id, username, display_name, avatar_url")
                .in("user_id", userIds);

            const profileMap: Record<string, any> = {};
            (profiles || []).forEach((p: any) => {
                profileMap[p.user_id] = p;
            });

            return (data as any[]).map((msg: any) => ({
                ...msg,
                profile: profileMap[msg.user_id] || null,
            })) as CommunityMessage[];
        },
        refetchInterval: 30000, // Fallback refetch every 30s
    });

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async (content: string) => {
            if (!user) throw new Error("Not authenticated");

            // Client-side rate limit: 1 message per 2 seconds
            const now = Date.now();
            if (now - lastSentRef.current < 2000) {
                throw new Error("rate_limit");
            }
            lastSentRef.current = now;

            const { error } = await sb.from("community_messages").insert({
                user_id: user.id,
                content: content.trim(),
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["community-chat"] });
        },
        onError: (err: any) => {
            if (err?.message === "rate_limit") {
                toast.error("Slow down! Wait a moment before sending another message.");
            } else if (err?.message?.includes("row-level security") || err?.message?.includes("permission denied")) {
                toast.error("You are banned from sending messages.");
            } else {
                toast.error("Message failed to send. Try again.");
            }
        },
    });

    // AI Mutation (Fire and Forget)
    const aiMutation = useMutation({
        mutationFn: async (userMessage: string) => {
            setIsAiThinking(true);
            const { fetchGroqReply } = await import("@/lib/groq");
            const userName = user?.user_metadata?.display_name || user?.user_metadata?.username || "a user";

            const allMessages = (queryClient.getQueryData<any[]>(["community-chat"]) || []);

            const aiThread = allMessages.filter(
                (msg: any) => msg.is_ai_reply || msg.content.toLowerCase().includes("@ai")
            );
            const regularContext = allMessages
                .filter((msg: any) => !msg.is_ai_reply && !msg.content.toLowerCase().includes("@ai"))
                .slice(-5);

            const combined = [...aiThread, ...regularContext]
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const history = combined.map((msg: any) => ({
                role: msg.is_ai_reply ? "assistant" : "user",
                content: msg.content,
            }));

            const replyContent = await fetchGroqReply(userMessage, userName, history as any);

            if (!user) return;

            const { error } = await sb.from("community_messages").insert({
                user_id: user.id,
                content: replyContent,
                is_ai_reply: true,
            });

            if (error) throw error;
        },
        onSettled: () => {
            setIsAiThinking(false);
            queryClient.invalidateQueries({ queryKey: ["community-chat"] });
        }
    });

    // Delete own message
    const deleteMessageMutation = useMutation({
        mutationFn: async (messageId: string) => {
            if (!user) throw new Error("Not authenticated");
            const { error } = await sb
                .from("community_messages")
                .delete()
                .eq("id", messageId)
                .eq("user_id", user.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["community-chat"] });
        },
        onError: () => {
            toast.error("Could not delete message.");
        },
    });

    // Realtime subscription for new messages + presence
    useEffect(() => {
        let cancelled = false;

        const timer = setTimeout(() => {
            if (cancelled) return;

            const channel = sb.channel("community-chat-room", {
                config: { presence: { key: user?.id || "anon" } },
            });
            channelRef.current = channel;

            channel
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "community_messages",
                    },
                    () => {
                        queryClient.invalidateQueries({ queryKey: ["community-chat"] });
                    }
                )
                .on("presence", { event: "sync" }, () => {
                    const state = channel.presenceState();
                    setOnlineCount(Object.keys(state).length);
                })
                .subscribe(async (status: string) => {
                    if (status === "SUBSCRIBED" && user) {
                        await channel.track({ user_id: user.id });
                    }
                });
        }, 100);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            if (channelRef.current) {
                const chan = channelRef.current;
                channelRef.current = null;
                
                const state = chan.state;
                if (state === 'joined' || state === 'joining') {
                     chan.unsubscribe().then(() => {
                         sb.removeChannel(chan).catch(() => {});
                     }).catch(() => {});
                } else {
                     sb.removeChannel(chan).catch(() => {});
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, queryClient]);

    return {
        messages,
        loadingMessages,
        onlineCount,
        sendMessage: async (content: string) => {
            if (!user) {
                toast.error("You must sign in to chat.");
                return;
            }
            const res = await sendMessageMutation.mutateAsync(content);
            
            // If message targets AI, spin off the AI mutation with a 0.5s natural delay
            if (content.toLowerCase().includes("@ai")) {
                setTimeout(() => {
                    aiMutation.mutate(content);
                }, 500);
            }
            return res;
        },
        deleteMessage: async (messageId: string) => {
            return deleteMessageMutation.mutateAsync(messageId);
        },
        isSending: sendMessageMutation.isPending,
        isAiThinking,
    };
}
