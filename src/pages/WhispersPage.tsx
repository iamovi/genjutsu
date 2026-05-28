import { useWhispers } from "@/hooks/useWhispers";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Send, LogIn, Users, MessageSquare } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { WhisperSidebar } from "@/components/WhisperSidebar";

const WhispersPage = () => {
    const { user } = useAuth();
    const { conversations } = useWhispers();
    const navigate = useNavigate();

    return (
        <div className="h-[100svh] bg-background text-foreground flex flex-col overflow-hidden">
            <Helmet>
                <title>Whispers — genjutsu</title>
                <meta name="description" content="Direct ephemeral messages on Genjutsu." />
            </Helmet>
            <div className="shrink-0">
                <Navbar />
            </div>

            <main className="flex-1 max-w-6xl w-full mx-auto flex overflow-hidden">
                <div className="w-full lg:w-80 shrink-0">
                    <WhisperSidebar />
                </div>

                <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 text-center bg-secondary/5">
                    {!user ? (
                        <div className="gum-card p-12 flex flex-col items-center gap-4 bg-background">
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
                        <div className="max-w-md space-y-4">
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                <MessageSquare size={40} className="text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">Your Whispers</h2>
                            <p className="text-muted-foreground">
                                Select a conversation to start whispering. Messages vanish after 24 hours. Silence is your cover.
                            </p>
                            <button
                                onClick={() => navigate("/search")}
                                className="mt-4 gum-btn bg-primary text-primary-foreground text-sm flex items-center gap-2 mx-auto"
                            >
                                <Send size={16} />
                                Start new conversation
                            </button>
                        </div>
                    ) : (
                        <div className="gum-card p-12 flex flex-col items-center gap-4 bg-background">
                            <div className="w-16 h-16 rounded-[3px] bg-secondary flex items-center justify-center border-2 border-primary/20">
                                <Send size={32} className="text-primary/50" />
                            </div>
                            <div className="max-w-sm">
                                <h3 className="font-bold text-lg">Silence in the abyss...</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    You haven't sent any whispers yet. Messages vanish after 24 hours.
                                </p>
                                <div className="flex flex-col gap-3 mt-6">
                                    <button
                                        onClick={() => navigate("/whispers/community")}
                                        className="gum-btn bg-primary text-primary-foreground text-sm flex items-center gap-2 justify-center"
                                    >
                                        <Users size={16} />
                                        Join Community Chat
                                    </button>
                                    <button
                                        onClick={() => navigate("/search")}
                                        className="text-sm border-2 border-border rounded-[3px] px-4 py-2 hover:bg-secondary transition-colors font-bold"
                                    >
                                        Find someone to whisper to
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default WhispersPage;
