import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect, useRef, useCallback, useState } from "react";
import { getNow } from "@/lib/utils";

export const BOT_REPLY_PREFIX = "[BOT_REPLY] ";

const hasBotMention = (content: string) => /\B@bot\b/i.test(content);
const isBotHiCommand = (content: string) => /\B@bot\s+hi\b/i.test(content);
const isBotPingCommand = (content: string) => /\B@bot\s+ping\b/i.test(content);
const isBotHelpCommand = (content: string) => /\B@bot\s+help\b/i.test(content);
const isBotWeatherCommand = (content: string) => /\B@bot\s+weather\b/i.test(content);
const isBotJokeCommand = (content: string) => /\B@bot\s+joke\b/i.test(content);
const isBotWhoAmICommand = (content: string) => /\B@bot\s+whoami\b/i.test(content);
const getBotWeatherCity = (content: string) => content.match(/\B@bot\s+weather(?:\s+(.+))?/i)?.[1]?.trim() || "";
const getBotWhoAmITarget = (content: string) => content.match(/\B@bot\s+whoami(?:\s+@?([a-z0-9_]+))?/i)?.[1]?.trim() || "";
const isBotReply = (content?: string) => (content || "").startsWith(BOT_REPLY_PREFIX);

const weatherCodeToLabel = (code?: number) => {
    const map: Record<number, string> = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    };
    return map[code ?? -1] || "Unknown";
};

const formatWeatherValue = (value: unknown) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const fetchWeatherForCity = async (cityQuery: string) => {
    const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodeUrl.searchParams.set("name", cityQuery);
    geocodeUrl.searchParams.set("count", "1");
    geocodeUrl.searchParams.set("language", "en");
    geocodeUrl.searchParams.set("format", "json");

    const geocodeRes = await fetch(geocodeUrl.toString());
    if (!geocodeRes.ok) throw new Error("geocode_failed");
    const geocodeData = await geocodeRes.json();
    const place = geocodeData?.results?.[0];

    if (!place || typeof place.latitude !== "number" || typeof place.longitude !== "number") {
        return `I couldn't find "${cityQuery}". Try \`@bot weather London\`.`;
    }

    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", String(place.latitude));
    weatherUrl.searchParams.set("longitude", String(place.longitude));
    weatherUrl.searchParams.set("timezone", "auto");
    weatherUrl.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");

    const weatherRes = await fetch(weatherUrl.toString());
    if (!weatherRes.ok) throw new Error("weather_failed");
    const weatherData = await weatherRes.json();

    const current = weatherData?.current;
    if (!current) throw new Error("weather_data_missing");

    const units = weatherData?.current_units || {};
    const location = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
    const condition = weatherCodeToLabel(current.weather_code);
    const temp = formatWeatherValue(current.temperature_2m);
    const feelsLike = formatWeatherValue(current.apparent_temperature);
    const wind = formatWeatherValue(current.wind_speed_10m);

    return `${location}: ${condition}. ${temp}${units.temperature_2m || "°C"} (feels ${feelsLike}${units.apparent_temperature || "°C"}), wind ${wind} ${units.wind_speed_10m || "km/h"}.`;
};

const fetchJoke = async () => {
    const jokeRes = await fetch("https://v2.jokeapi.dev/joke/Any?safe-mode");
    if (!jokeRes.ok) throw new Error("joke_failed");
    const data = await jokeRes.json();

    if (!data || data.error) {
        throw new Error("joke_failed");
    }

    if (data.type === "single" && typeof data.joke === "string" && data.joke.trim()) {
        return data.joke.trim();
    }

    if (
        data.type === "twopart" &&
        typeof data.setup === "string" &&
        data.setup.trim() &&
        typeof data.delivery === "string" &&
        data.delivery.trim()
    ) {
        return `${data.setup.trim()} ${data.delivery.trim()}`;
    }

    throw new Error("joke_payload_invalid");
};

const formatMonthYear = (isoDate?: string) => {
    if (!isoDate) return "Unknown";
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

const formatWhoAmIResponse = (profile: any, counts?: { followers: number | null; following: number | null; posts24h: number | null }) => {
    const bioText = typeof profile?.bio === "string" && profile.bio.trim() ? profile.bio.trim() : "No bio yet.";
    const followers = counts?.followers ?? "N/A";
    const following = counts?.following ?? "N/A";
    const posts24h = counts?.posts24h ?? "N/A";
    return `here is profile info for @${profile.username}: Name: ${profile.display_name}. Joined: ${formatMonthYear(profile.created_at)}. Followers: ${followers}, Following: ${following}, Posts (24h): ${posts24h}. Bio: ${bioText}`;
};

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
    const [isBotThinking, setIsBotThinking] = useState(false);
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

            // Filter out the exact user message that is currently being processed
            // (in case the useMutation `onSuccess` has already optimistically injected it)
            const priorMessages = allMessages.filter(
                (msg: any) => msg.content !== userMessage
            );

            const aiThread = priorMessages.filter(
                (msg: any) => (msg.is_ai_reply && !isBotReply(msg.content)) || msg.content.toLowerCase().includes("@ai")
            ).slice(-10);
            
            const regularContext = priorMessages
                .filter((msg: any) => !msg.is_ai_reply && !msg.content.toLowerCase().includes("@ai"))
                .slice(-5);

            const combined = [...aiThread, ...regularContext]
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const history = combined.map((msg: any) => ({
                role: msg.is_ai_reply ? "assistant" : "user",
                content: msg.is_ai_reply 
                    ? msg.content 
                    : `[${msg.profile?.display_name || msg.profile?.username || "Unknown"}]: ${msg.content}`,
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

    // Bot command mutation (@bot)
    const botMutation = useMutation({
        mutationFn: async (userMessage: string) => {
            setIsBotThinking(true);

            if (!user) return;

            const username =
                user.user_metadata?.username ||
                user.user_metadata?.user_name ||
                user.user_metadata?.display_name ||
                user.email?.split("@")[0] ||
                "there";

            const weatherCity = getBotWeatherCity(userMessage);
            const whoAmITarget = getBotWhoAmITarget(userMessage);

            let responseText = "I support `@bot hi`, `@bot ping`, `@bot help`, `@bot weather <city>`, `@bot joke`, and `@bot whoami [@username]` right now.";
            if (isBotHiCommand(userMessage)) {
                responseText = `hey ${username}`;
            } else if (isBotPingCommand(userMessage)) {
                responseText = "pong";
            } else if (isBotHelpCommand(userMessage)) {
                responseText = "Available commands: @bot hi, @bot ping, @bot help, @bot weather <city>, @bot joke, @bot whoami [@username]";
            } else if (isBotWeatherCommand(userMessage)) {
                if (!weatherCity) {
                    responseText = "Usage: `@bot weather <city>`";
                } else {
                    try {
                        responseText = await fetchWeatherForCity(weatherCity);
                    } catch {
                        responseText = "Weather lookup failed right now. Please try again in a moment.";
                    }
                }
            } else if (isBotJokeCommand(userMessage)) {
                try {
                    const joke = await fetchJoke();
                    responseText = `here is a joke for ${username}: ${joke}`;
                } catch {
                    responseText = "Joke service is unavailable right now. Try again in a moment.";
                }
            } else if (isBotWhoAmICommand(userMessage)) {
                if (whoAmITarget && !/^[a-z0-9_]{3,20}$/i.test(whoAmITarget)) {
                    responseText = "Usage: `@bot whoami` or `@bot whoami @username`";
                } else {
                    try {
                        const targetProfileQuery = whoAmITarget
                            ? sb
                                .from("profiles")
                                .select("user_id, username, display_name, bio, created_at")
                                .eq("username", whoAmITarget.toLowerCase())
                                .maybeSingle()
                            : sb
                                .from("profiles")
                                .select("user_id, username, display_name, bio, created_at")
                                .eq("user_id", user.id)
                                .maybeSingle();

                        const { data: targetProfile, error: targetProfileError } = await targetProfileQuery;
                        if (targetProfileError) throw targetProfileError;

                        if (!targetProfile) {
                            responseText = whoAmITarget
                                ? `I couldn't find @${whoAmITarget}.`
                                : "I couldn't find your profile.";
                        } else {
                            let counts: { followers: number | null; following: number | null; posts24h: number | null } | undefined;
                            try {
                                const since24h = new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString();
                                const [followersRes, followingRes, postsRes] = await Promise.all([
                                    sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetProfile.user_id),
                                    sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetProfile.user_id),
                                    sb.from("posts").select("*", { count: "exact", head: true }).eq("user_id", targetProfile.user_id).gt("created_at", since24h),
                                ]);

                                counts = {
                                    followers: followersRes.count ?? null,
                                    following: followingRes.count ?? null,
                                    posts24h: postsRes.count ?? null,
                                };
                            } catch {
                                counts = undefined;
                            }

                            responseText = formatWhoAmIResponse(targetProfile, counts);
                        }
                    } catch {
                        responseText = "Profile lookup failed right now. Please try again.";
                    }
                }
            }

            const { error } = await sb.from("community_messages").insert({
                user_id: user.id,
                content: `${BOT_REPLY_PREFIX}${responseText}`,
                is_ai_reply: true,
            });

            if (error) throw error;
        },
        onError: () => {
            toast.error("Bot failed to respond.");
        },
        onSettled: () => {
            setIsBotThinking(false);
            queryClient.invalidateQueries({ queryKey: ["community-chat"] });
        },
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
            const normalized = content.trim();
            const res = await sendMessageMutation.mutateAsync(normalized);
            
            // If message targets AI, spin off the AI mutation with a 0.5s natural delay
            if (normalized.toLowerCase().includes("@ai")) {
                setTimeout(() => {
                    aiMutation.mutate(normalized);
                }, 500);
            }

            // If message targets Bot, spin off the Bot mutation with a 0.5s natural delay
            if (hasBotMention(normalized)) {
                setTimeout(() => {
                    botMutation.mutate(normalized);
                }, 500);
            }
            return res;
        },
        deleteMessage: async (messageId: string) => {
            return deleteMessageMutation.mutateAsync(messageId);
        },
        isSending: sendMessageMutation.isPending,
        isAiThinking,
        isBotThinking,
    };
}
