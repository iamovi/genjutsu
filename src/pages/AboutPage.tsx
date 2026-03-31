import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Eye, Code, Zap, Shield, ArrowLeft, MessageSquare, Swords, Ghost, Infinity as InfinityIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const AboutPage = () => {
    const { user } = useAuth();
    const features = [
        {
            icon: <Zap className="text-primary" size={20} />,
            title: "24-Hour Existence",
            description: "Every post, every whisper, and every interaction lives for exactly 24 hours. After that, they vanish into the void. No archives, no footprints, no regrets."
        },
        {
            icon: <Code className="text-primary" size={20} />,
            title: "Built for Builders",
            description: "Share snippets with full syntax highlighting. Use README mode to give your thoughts the space they deserve. Genjutsu is a home for code first."
        },
        {
            icon: <MessageSquare className="text-primary" size={20} />,
            title: "Whispers",
            description: "Direct messaging redefined. Chat in real-time with fellow developers. Your conversations are as temporary as your posts, ensuring total privacy."
        },
        {
            icon: <Swords className="text-primary" size={20} />,
            title: "Real-time Play",
            description: "Bored? Challenge other online developers to a quick game. Our P2P matchmaking system makes it easy to take a break and connect."
        },
        {
            icon: <Shield className="text-primary" size={20} />,
            title: "Safe & Sanitized",
            description: "We use server-side rate limiting and idempotency controls to keep the community clean from bots and spam, focusing on human-to-human interaction."
        },
        {
            icon: <InfinityIcon className="text-primary" size={20} />,
            title: "Transient Arts",
            description: "The name 'Genjutsu' (幻術) means illusionary arts. We believe the internet should be as transient as conversation—powerful in the moment, but destined to fade."
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>About genjutsu — The Art of Illusions</title>
                <meta name="description" content="Learn about genjutsu, the social platform for developers where everything disappears after 24 hours." />
            </Helmet>
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-3 py-1.5 gum-card bg-secondary text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-colors w-fit"
                        >
                            <ArrowLeft size={14} />
                            Back to Home
                        </Link>

                        <div className="gum-card p-6 md:p-10">
                            <section className="mb-12">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-[4px] gum-border overflow-hidden shrink-0 rotate-3">
                                        <img src="/fav.jpg" alt="genjutsu" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h1 className="text-4xl font-bold tracking-tighter">The Art of Illusions</h1>
                                        <p className="text-primary font-mono text-sm">genjutsu (幻術) — Everything vanishes.</p>
                                    </div>
                                </div>

                                <div className="prose dark:prose-invert max-w-none text-base leading-relaxed text-foreground/90">
                                    <p className="text-lg font-medium leading-relaxed italic border-l-4 border-primary pl-4 py-2 bg-secondary/30 rounded-r-lg">
                                        "Digital permanence is an illusion. We've just made it official."
                                    </p>
                                    <p className="mt-6">
                                        Genjutsu is a social platform built for developers who value <strong>focus over clutter</strong>.
                                        In a world where every digital footprint is tracked and archived forever, we offer a sanctuary of transience.
                                        Whether it's a code snippet, a tech rant, or a late-night whisper, it lives vividly for 24 hours and then disappears—leaving no trace.
                                    </p>
                                </div>
                            </section>

                            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                                {features.map((feature, index) => (
                                    <motion.div
                                        key={feature.title}
                                        initial={{ opacity: 0, x: index % 2 === 0 ? -10 : 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="gum-card p-6 border-primary/10 hover:border-primary/30 transition-colors group"
                                    >
                                        <div className="w-10 h-10 rounded-[3px] bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            {feature.icon}
                                        </div>
                                        <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                                        <p className="text-sm text-foreground/70 leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </motion.div>
                                ))}
                            </section>

                            <section className="bg-secondary/20 rounded-[3px] p-8 border-2 border-dashed border-border text-center">
                                <Ghost className="mx-auto text-primary/30 mb-4" size={48} />
                                <h2 className="text-2xl font-bold mb-3 tracking-tight">No Archives. No Regrets.</h2>
                                <p className="text-sm text-foreground/70 max-w-lg mx-auto leading-relaxed mb-6">
                                    We don't sell your data because we don't keep it. Our systems are designed to purge everything
                                    after the 24-hour mark, ensuring your past doesn't define your presence in the community.
                                </p>
                                <Link
                                    to={user ? "/" : "/auth"}
                                    className="gum-btn bg-primary text-primary-foreground inline-flex items-center gap-2"
                                >
                                    {user ? "Cast an illusion" : "Cast your first spell"}
                                </Link>
                            </section>

                            <footer className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="text-xs text-muted-foreground">
                                    Created with focus by <a href="https://iamovi.github.io/" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">Ovi ren</a>
                                </div>
                                <div className="flex gap-4 text-xs font-bold uppercase tracking-wider">
                                    <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                                    <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                                </div>
                            </footer>
                        </div>
                    </motion.div>

                    <div className="hidden lg:block lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 custom-scrollbar">
                        <Sidebar />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AboutPage;
