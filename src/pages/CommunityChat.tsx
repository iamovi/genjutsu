import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCommunityChat, CommunityMessage } from "@/hooks/useCommunityChat";
import Navbar from "@/components/Navbar";
import { ArrowLeft, Send, Trash2, Users, Ghost } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Helmet } from "react-helmet-async";
import { linkify } from "@/lib/linkify";
import ReactMarkdown from "react-markdown";
import WhisperLinkPreview from "@/components/WhisperLinkPreview";

function ChatInputForm({ sendMessage, isSending, user, navigate }: any) {
    const [messageText, setMessageText] = useState("");
    const [showAiMention, setShowAiMention] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setMessageText(val);
        
        // Detect AI mention typing at the end of string
        const lowerVal = val.toLowerCase();
        if (lowerVal.endsWith("@") || lowerVal.endsWith("@a") || lowerVal.endsWith("@ai")) {
            setShowAiMention(true);
        } else {
            setShowAiMention(false);
        }
    };

    const handleAiMentionSelect = () => {
        let newVal = messageText;
        const lowerVal = newVal.toLowerCase();
        if (lowerVal.endsWith("@ai")) newVal = newVal.slice(0, -3);
        else if (lowerVal.endsWith("@a")) newVal = newVal.slice(0, -2);
        else if (lowerVal.endsWith("@")) newVal = newVal.slice(0, -1);
        
        setMessageText(newVal + "@ai ");
        setShowAiMention(false);
        inputRef.current?.focus();
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setShowAiMention(false);
        if (!messageText.trim() || isSending) return;

        try {
            await sendMessage(messageText.trim());
            setMessageText("");
        } catch {
            // Error handled in hook
        }
    };

    return (
        <footer className="shrink-0 bg-background/95 backdrop-blur-md border-t-2 border-border p-4 pb-safe relative">
            <AnimatePresence>
                {showAiMention && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-4 mb-2 z-50 min-w-[200px]"
                    >
                        <div className="bg-popover text-popover-foreground gum-border gum-shadow rounded-[3px] overflow-hidden flex flex-col p-1">
                            <span className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Agents</span>
                            <button
                                type="button"
                                onClick={handleAiMentionSelect}
                                className="flex items-center gap-2 p-2 hover:bg-secondary transition-colors text-left rounded-sm w-full"
                            >
                                <div className="w-7 h-7 rounded-[3px] border-2 border-primary/20 bg-primary/10 flex items-center justify-center shrink-0">
                                    <Ghost size={14} className="text-primary animate-pulse" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm leading-none text-primary">Genjutsu AI</span>
                                    <span className="text-[10px] text-muted-foreground leading-none mt-1">@ai</span>
                                </div>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {user ? (
                <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3">
                    <input
                        type="text"
                        ref={inputRef}
                        value={messageText}
                        onChange={handleInputChange}
                        placeholder="Say something to the community..."
                        maxLength={500}
                        className="flex-1 bg-secondary/50 gum-border py-2.5 px-4 outline-none focus:border-primary transition-colors text-sm"
                        autoComplete="new-password"
                    />
                    <button
                        type="submit"
                        disabled={!messageText.trim() || isSending}
                        className="gum-btn bg-primary text-primary-foreground px-5 h-10 flex items-center gap-2"
                    >
                        {isSending ? <FrogLoader size={16} className="" /> : <Send size={16} />}
                        <span className="hidden sm:inline">Send</span>
                    </button>
                </form>
            ) : (
                <div className="max-w-4xl mx-auto text-center">
                    <button
                        onClick={() => navigate("/auth")}
                        className="gum-btn bg-primary text-primary-foreground text-sm px-6 py-2.5"
                    >
                        Sign in to chat
                    </button>
                </div>
            )}
        </footer>
    );
}

const CommunityChat = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {
        messages,
        loadingMessages,
        onlineCount,
        sendMessage,
        deleteMessage,
        isSending,
        isAiThinking,
    } = useCommunityChat();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isAiThinking]);



    if (loadingMessages) {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
                <FrogLoader className=" text-primary" size={32} />
                <p className="mt-4 text-sm text-muted-foreground animate-pulse">Entering the void...</p>
            </div>
        );
    }

    return (
        <div className="h-[100svh] bg-background text-foreground flex flex-col overflow-hidden">
            <Helmet>
                <title>Community Chat — genjutsu</title>
                <meta name="description" content="Public community chat on Genjutsu. Messages vanish in 24 hours." />
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
                                <div className="w-10 h-10 rounded-[3px] gum-border bg-primary/10 flex items-center justify-center shrink-0">
                                    <Users size={20} className="text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm -mb-0.5">Community Chat</h3>
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                        {onlineCount} online
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
            </div>

            <main className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 space-y-3 scrollbar-hide flex flex-col">
                <div className="flex-1" />

                {/* System welcome message */}
                <div className="text-center py-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[3px] bg-secondary/50 border-2 border-dashed border-border text-xs text-muted-foreground font-mono">
                        Public room — messages vanish in 24h
                    </div>
                </div>

                {messages && messages.length > 0 ? (
                    messages.map((msg: CommunityMessage) => {
                        const isAi = msg.is_ai_reply === true;
                        const isMe = msg.user_id === user?.id && !isAi;
                        
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex w-full min-w-0 ${isMe ? "justify-end" : "justify-start"}`}
                            >
                                <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[70%] min-w-0">
                                    {/* Avatar (only for others or AI) */}
                                    {!isMe && (
                                        <button
                                            onClick={() => !isAi && msg.profile?.username && navigate(`/u/${msg.profile.username}`)}
                                            className={`w-7 h-7 rounded-[3px] gum-border flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden transition-opacity ${!isAi ? "bg-secondary hover:opacity-80" : "bg-primary text-primary-foreground cursor-default"}`}
                                        >
                                            {isAi ? (
                                                <Ghost size={14} />
                                            ) : msg.profile?.avatar_url ? (
                                                <img src={msg.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                (msg.profile?.display_name?.[0] || "?").toUpperCase()
                                            )}
                                        </button>
                                    )}

                                    <div className={`px-3.5 py-2 text-sm border-2 rounded-[3px] gum-shadow-sm min-w-0 ${isMe
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-secondary text-secondary-foreground border-border"
                                        }`}>
                                        {/* Username label for others */}
                                        {!isMe && (
                                            <button
                                                onClick={() => !isAi && msg.profile && navigate(`/u/${msg.profile.username}`)}
                                                className={`text-[10px] font-bold block mb-1.5 ${isAi ? "text-primary cursor-default pointer-events-none" : "opacity-70 hover:underline"}`}
                                            >
                                                {isAi ? "Genjutsu AI" : msg.profile ? `@${msg.profile.username}` : "Unknown"}
                                            </button>
                                        )}
                                        <div className="whitespace-pre-wrap break-words min-w-0 max-w-full">
                                            {isAi ? (
                                                <ReactMarkdown
                                                    components={{
                                                        pre: ({ children }: any) => (
                                                            <div className="relative my-2 rounded-[3px] gum-border bg-background/50 overflow-hidden shrink-0 max-w-full">
                                                                <div className="text-[10px] bg-secondary/80 px-2 py-1 border-b-[1px] border-border font-mono opacity-70">Code Snippet</div>
                                                                <pre className="p-3 overflow-x-auto text-xs font-mono scrollbar-hide max-w-full">
                                                                    {children}
                                                                </pre>
                                                            </div>
                                                        ),
                                                        code: ({ children, className }: any) => {
                                                            const isInline = !className;
                                                            return isInline ? (
                                                                <code className="bg-secondary/50 px-1 py-0.5 rounded-[3px] text-[11px] font-mono">{children}</code>
                                                            ) : (
                                                                <code className={`${className} text-[11px]`}>{children}</code>
                                                            );
                                                        },
                                                        p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed text-[13px]">{children}</p>,
                                                        ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                                        ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                                                        li: ({ children }: any) => <li className="text-[13px]">{children}</li>,
                                                        a: ({ children, href }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">{children}</a>
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            ) : (
                                                <>
                                                    <p>
                                                        {linkify(msg.content, isMe)}
                                                    </p>
                                                    <WhisperLinkPreview content={msg.content} isMe={isMe} />
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[9px] font-mono opacity-60 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {isMe && (
                                                <button
                                                    onClick={() => deleteMessage(msg.id)}
                                                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity"
                                                    title="Delete message"
                                                >
                                                    <Trash2 size={10} className="text-primary-foreground/50 hover:text-primary-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="py-12 text-center text-xs text-muted-foreground italic flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-[3px] border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                            <Users size={16} className="opacity-40" />
                        </div>
                        No one has spoken yet. Break the silence.
                    </div>
                )}

                {/* AI Thinking Indicator */}
                {isAiThinking && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[70%] mt-2">
                            <div className="w-7 h-7 rounded-[3px] gum-border bg-primary flex items-center justify-center shrink-0">
                                <Ghost size={14} className="text-primary-foreground animate-pulse" />
                            </div>
                            <div className="px-3.5 py-2 text-sm border-2 rounded-[3px] gum-shadow-sm bg-secondary text-secondary-foreground border-border">
                                <p className="text-[10px] font-bold text-primary block mb-0.5">Genjutsu AI</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">Computing
                                    <span className="flex gap-0.5 pt-1 text-primary">
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                    </span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} className="h-4" />
            </main>

            <ChatInputForm sendMessage={sendMessage} isSending={isSending} user={user} navigate={navigate} />
        </div>
    );
};

export default CommunityChat;
