import { motion } from "framer-motion";
import { useWhispers } from "@/hooks/useWhispers";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { Send, Loader2, ArrowLeft, LogIn, Users } from "lucide-react";
import { Helmet } from "react-helmet-async";

const WhispersPage = () => {
    const { user } = useAuth();
    const { conversations, loadingConversations } = useWhispers();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>Whispers — genjutsu</title>
                <meta name="description" content="Direct ephemeral messages on Genjutsu." />
            </Helmet>
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    if (window.history.length > 2) {
                                        navigate(-1);
                                    } else {
                                        navigate("/");
                                    }
                                }}
                                className="p-2 hover:bg-secondary rounded-[3px] transition-colors border-2 border-transparent hover:border-border"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-xl font-bold tracking-tight">Whispers</h1>
                        </div>

                        {loadingConversations ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="animate-spin text-primary" size={32} />
                            </div>
                        ) : !user ? (
                            <div className="gum-card p-12 text-center flex flex-col items-center gap-4 bg-secondary/20 border-dashed">
                                <div className="w-16 h-16 rounded-[3px] bg-secondary flex items-center justify-center border-2 border-primary/20">
                                    <LogIn size={32} className="text-primary/50" />
                                </div>
                                <div className="max-w-sm">
                                    <h3 className="font-bold text-lg">Identity unknown</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Sign in to see your whispers and start new ephemeral conversations.
                                    </p>
                                    <button
                                        onClick={() => navigate("/auth")}
                                        className="mt-6 gum-btn bg-primary text-primary-foreground text-sm flex items-center gap-2 mx-auto"
                                    >
                                        <LogIn size={16} />
                                        Get Started
                                    </button>
                                </div>
                            </div>
                        ) : conversations && conversations.length > 0 ? (
                            <div className="space-y-3">
                                {/* Pinned Community Chat */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => navigate("/whispers/community")}
                                    className="gum-card p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/50 transition-all group border-primary/30 bg-primary/5"
                                >
                                    <div className="w-12 h-12 rounded-[3px] gum-border bg-primary/10 flex items-center justify-center shrink-0">
                                        <Users size={22} className="text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold group-hover:underline">Community Chat</h4>
                                        <p className="text-xs text-muted-foreground italic truncate">Public room — everyone can join</p>
                                    </div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 animate-pulse" />
                                </motion.div>

                                {conversations.map((conv) => (
                                    <motion.div
                                        key={conv.user_id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => navigate(`/whisper/${conv.username}`)}
                                        className={`gum-card p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/50 transition-all group ${conv.has_unread ? "border-primary/40 bg-primary/5" : ""
                                            }`}
                                    >
                                        <div className="w-12 h-12 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                                            {conv.avatar_url ? (
                                                <img src={conv.avatar_url} alt={conv.username} className="w-full h-full object-cover" />
                                            ) : conv.display_name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className={`group-hover:underline truncate ${conv.has_unread ? "font-extrabold" : "font-bold"
                                                    }`}>{conv.display_name}</h4>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className={`text-xs truncate italic ${conv.has_unread ? "text-foreground font-semibold" : "text-muted-foreground"
                                                }`}>
                                                "{conv.last_message.substring(0, 60)}"
                                            </p>
                                        </div>
                                        {conv.has_unread && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 animate-pulse" />
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="gum-card p-12 text-center flex flex-col items-center gap-4 bg-secondary/20 border-dashed">
                                <div className="w-16 h-16 rounded-[3px] bg-secondary flex items-center justify-center border-2 border-primary/20">
                                    <Send size={32} className="text-primary/50" />
                                </div>
                                <div className="max-w-sm">
                                    <h3 className="font-bold text-lg">Silence in the abyss...</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        You haven't sent any whispers yet. Messages vanish after 24 hours. Silence is your cover.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
                                        <button
                                            onClick={() => navigate("/whispers/community")}
                                            className="gum-btn bg-primary text-primary-foreground text-sm flex items-center gap-2 justify-center"
                                        >
                                            <Users size={16} />
                                            Join Community Chat
                                        </button>
                                        <button
                                            onClick={() => navigate("/search")}
                                            className="text-sm border-2 border-border rounded-[3px] px-4 py-2 hover:bg-secondary transition-colors"
                                        >
                                            Find someone to whisper to
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="hidden lg:block lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 custom-scrollbar">
                        <Sidebar />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default WhispersPage;
