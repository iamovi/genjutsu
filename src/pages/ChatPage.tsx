import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWhispers, Whisper } from "@/hooks/useWhispers";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Loader2, ArrowLeft, Send, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { linkify } from "@/lib/linkify";

const ChatPage = () => {
    const { username } = useParams<{ username: string }>();
    const [targetProfile, setTargetProfile] = useState<{ user_id: string; display_name: string; avatar_url: string | null; username: string } | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [messageText, setMessageText] = useState("");
    const { user } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch target profile first
    useEffect(() => {
        const fetchProfile = async () => {
            if (!username) return;
            try {
                setLoadingProfile(true);
                const { data, error } = await supabase
                    .from("profiles")
                    .select("user_id, display_name, avatar_url, username")
                    .eq("username", username.toLowerCase())
                    .single();

                if (error) throw error;
                if (!data) throw new Error("User not found");
                if (user && data.user_id === user.id) {
                    toast.error("You can't whisper to yourself!");
                    navigate("/whispers");
                    return;
                }
                setTargetProfile(data);
            } catch (err: any) {
                console.error("Profile load error:", err);
                toast.error("Character not found in the abyss");
                navigate("/whispers");
            } finally {
                setLoadingProfile(false);
            }
        };
        fetchProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, navigate]);

    const { messages, loadingMessages, sendMessage, isSending, setTyping, isOtherUserTyping } = useWhispers(targetProfile?.user_id);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOtherUserTyping]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMessageText(value);

        if (!targetProfile || !user) return;

        // Broadcast typing=true
        setTyping(true);

        // Debounce typing=false
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
        }, 2000);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || isSending || !targetProfile) return;

        // Immediately stop typing indicator on send
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setTyping(false);

        try {
            await sendMessage(messageText.trim());
            setMessageText("");
        } catch (err) {
            // Already handled in hook toast
        }
    };

    if (loadingProfile || loadingMessages) {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="mt-4 text-sm text-muted-foreground animate-pulse">Whispering to the abyss...</p>
            </div>
        );
    }

    if (!targetProfile) return null;


    return (
        <div className="h-[100svh] bg-background text-foreground flex flex-col overflow-hidden">
            <Helmet>
                <title>Whispering to {targetProfile.display_name} — genjutsu</title>
            </Helmet>
            <div className="shrink-0">
                <Navbar />
                <header className="z-40 bg-background/80 backdrop-blur-md border-b-2 border-border shadow-sm">
                    <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if (window.history.length > 2) {
                                        navigate(-1);
                                    } else {
                                        navigate("/whispers");
                                    }
                                }}
                                className="p-2 hover:bg-secondary rounded-[3px] transition-colors"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                    {targetProfile.avatar_url ? (
                                        <img src={targetProfile.avatar_url} alt={targetProfile.username} className="w-full h-full object-cover" />
                                    ) : targetProfile.display_name[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm -mb-0.5 truncate">{targetProfile.display_name}</h3>
                                    <p className="text-[10px] text-muted-foreground truncate">@{targetProfile.username}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
            </div>

            <main className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 space-y-4 scrollbar-hide flex flex-col">
                <div className="flex-1" /> {/* Spacer to push messages to bottom if few */}
                {messages && messages.length > 0 ? (
                    messages.map((whisper: Whisper) => {
                        const isMe = whisper.sender_id === user?.id;
                        return (
                            <motion.div
                                key={whisper.id}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 text-sm border-2 rounded-[3px] gum-shadow-sm ${isMe
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-secondary text-secondary-foreground border-border"
                                    }`}>
                                    <p className="whitespace-pre-wrap break-words">
                                        {linkify(whisper.content)}
                                    </p>                                    <span className={`text-[9px] mt-1.5 block font-mono opacity-60 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                        {new Date(whisper.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="py-20 text-center text-xs text-muted-foreground italic flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-[3px] border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                            <Send size={16} className="opacity-40" />
                        </div>
                        This conversation is a void. Start whispering now.
                    </div>
                )}

                <AnimatePresence>
                    {isOtherUserTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="flex justify-start mb-2"
                        >
                            <div className="bg-secondary/30 border-2 border-border/50 rounded-[3px] px-3 py-1.5 flex items-center gap-2">
                                <div className="flex gap-1">
                                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground italic capitalize">
                                    {targetProfile.display_name} is whispering...
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div ref={messagesEndRef} className="h-4" />
            </main>

            <footer className="shrink-0 bg-background/95 backdrop-blur-md border-t-2 border-border p-4 pb-safe">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3">
                    <input
                        type="text"
                        id="whisper-input"
                        name="whisper"
                        value={messageText}
                        onChange={handleInputChange}
                        placeholder="Type a whisper... they vanish in 24h"
                        className="flex-1 bg-secondary/50 gum-border py-2.5 px-4 outline-none focus:border-primary transition-colors text-sm"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!messageText.trim() || isSending}
                        className="gum-btn bg-primary text-primary-foreground px-5 h-10 flex items-center gap-2"
                    >
                        {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        <span className="hidden sm:inline">Whisper</span>
                    </button>
                </form>
            </footer>
        </div>
    );
};

export default ChatPage;
