import { motion } from "framer-motion";
import { useWhispers } from "@/hooks/useWhispers";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { Send, Loader2, ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";

const WhispersPage = () => {
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
                                onClick={() => navigate(-1)}
                                className="p-2 hover:bg-secondary rounded-lg transition-colors border-2 border-transparent hover:border-border"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-xl font-bold tracking-tight">Whispers</h1>
                        </div>

                        {loadingConversations ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="animate-spin text-primary" size={32} />
                            </div>
                        ) : conversations && conversations.length > 0 ? (
                            <div className="space-y-3">
                                {conversations.map((conv) => (
                                    <motion.div
                                        key={conv.user_id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => navigate(`/whisper/${conv.username}`)}
                                        className="gum-card p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/50 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                                            {conv.avatar_url ? (
                                                <img src={conv.avatar_url} alt={conv.username} className="w-full h-full object-cover" />
                                            ) : conv.display_name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-bold group-hover:underline truncate">{conv.display_name}</h4>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate italic">
                                                "{conv.last_message.substring(0, 60)}"
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="gum-card p-12 text-center flex flex-col items-center gap-4 bg-secondary/20 border-dashed">
                                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center border-2 border-primary/20">
                                    <Send size={32} className="text-primary/50" />
                                </div>
                                <div className="max-w-sm">
                                    <h3 className="font-bold text-lg">Silence in the abyss...</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        You haven't sent any whispers yet. Messages vanish after 24 hours. Silence is your cover.
                                    </p>
                                    <button
                                        onClick={() => navigate("/search")}
                                        className="mt-6 gum-btn bg-primary text-primary-foreground text-sm"
                                    >
                                        Find someone to whisper to
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="hidden lg:block">
                        <Sidebar />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default WhispersPage;
