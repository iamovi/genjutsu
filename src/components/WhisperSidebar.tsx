import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useWhispers, Conversation } from "@/hooks/useWhispers";
import { useAuth } from "@/hooks/useAuth";
import { Users, Send, LogIn } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";

interface WhisperSidebarProps {
    activeUserId?: string;
    isCommunityActive?: boolean;
}

export const WhisperSidebar = ({ activeUserId, isCommunityActive }: WhisperSidebarProps) => {
    const { user } = useAuth();
    const { conversations, loadingConversations } = useWhispers();
    const navigate = useNavigate();

    if (!user) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-4 bg-secondary/10 border-r-2 border-border">
                <div className="w-12 h-12 rounded-[3px] bg-secondary flex items-center justify-center border-2 border-primary/20">
                    <LogIn size={24} className="text-primary/50" />
                </div>
                <div>
                    <h3 className="font-bold text-sm">Identity unknown</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Sign in to see your whispers.
                    </p>
                    <button
                        onClick={() => navigate("/auth")}
                        className="mt-4 gum-btn bg-primary text-primary-foreground text-[10px] py-1.5 px-3 flex items-center gap-2 mx-auto"
                    >
                        <LogIn size={12} />
                        Get Started
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background border-r-2 border-border overflow-hidden">
            <div className="p-4 border-b-2 border-border bg-secondary/20 flex items-center justify-between">
                <h2 className="font-bold tracking-tight">Whispers</h2>
                <button
                    onClick={() => navigate("/search")}
                    className="p-1.5 hover:bg-secondary rounded-[3px] transition-colors"
                    title="Find someone"
                >
                    <Send size={16} className="text-muted-foreground" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {loadingConversations ? (
                    <div className="flex justify-center py-10">
                        <FrogLoader className=" text-primary" size={24} />
                    </div>
                ) : (
                    <>
                        {/* Community Chat */}
                        <motion.div
                            whileHover={{ x: 4 }}
                            onClick={() => navigate("/whispers/community")}
                            className={`p-3 flex items-center gap-3 cursor-pointer rounded-[3px] transition-all group border-2 ${
                                isCommunityActive
                                ? "border-primary bg-primary/10 shadow-gum-sm"
                                : "border-transparent hover:bg-secondary/50"
                            }`}
                        >
                            <div className="w-10 h-10 rounded-[3px] gum-border bg-primary/10 flex items-center justify-center shrink-0">
                                <Users size={18} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold truncate">Community Chat</h4>
                                <p className="text-[10px] text-muted-foreground italic truncate">Public room</p>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                        </motion.div>

                        {conversations && conversations.length > 0 ? (
                            conversations.map((conv: Conversation) => (
                                <motion.div
                                    key={conv.user_id}
                                    whileHover={{ x: 4 }}
                                    onClick={() => navigate(`/whisper/${conv.username}`)}
                                    className={`p-3 flex items-center gap-3 cursor-pointer rounded-[3px] transition-all group border-2 ${
                                        activeUserId === conv.user_id
                                        ? "border-primary bg-primary/10 shadow-gum-sm"
                                        : conv.has_unread
                                            ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                                            : "border-transparent hover:bg-secondary/50"
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                        {conv.avatar_url ? (
                                            <img src={conv.avatar_url} alt={conv.username} className="w-full h-full object-cover" loading="lazy" />
                                        ) : conv.display_name[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <h4 className={`text-sm truncate ${conv.has_unread ? "font-extrabold" : "font-bold"}`}>{conv.display_name}</h4>
                                            <span className="text-[9px] text-muted-foreground whitespace-nowrap ml-2">
                                                {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className={`text-[11px] truncate italic ${conv.has_unread ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                                            {conv.last_message}
                                        </p>
                                    </div>
                                    {conv.has_unread && (
                                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                                    )}
                                </motion.div>
                            ))
                        ) : !loadingConversations && (
                            <div className="py-10 text-center px-4">
                                <p className="text-[10px] text-muted-foreground italic">No other whispers yet...</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
