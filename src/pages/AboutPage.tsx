import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Code, Zap, Shield, ArrowLeft, Ghost, Github, Paintbrush, Trash2, Gamepad2, Share2, Smartphone, MessageCircle, Clock, UsersRound, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";

const AboutPage = () => {
    const { user } = useAuth();

    const { data: contributors, isLoading: isLoadingContributors } = useQuery({
        queryKey: ['github-contributors'],
        queryFn: async () => {
            const res = await fetch('https://api.github.com/repos/iamovi/genjutsu/contributors');
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
    const features = [
        {
            icon: <Clock className="text-primary" size={20} />,
            title: "24-Hour Lifespan",
            description: "Every post, comment, and interaction has a strictly enforced 24-hour timer. True deletes — not just hidden from UI."
        },
        {
            icon: <Code className="text-primary" size={20} />,
            title: "Developer First",
            description: "Optimized for sharing code snippets and technical insights. Post freely without worrying about your permanent record."
        },
        {
            icon: <Paintbrush className="text-primary" size={20} />,
            title: "Manga Aesthetic",
            description: "A clean, high-contrast visual style inspired by Japanese manga. Bold. Minimal. Animated with Framer Motion."
        },
        {
            icon: <Zap className="text-primary" size={20} />,
            title: "Real-time Feed",
            description: "Instant engagement powered by Supabase. Pure chronological connection. The feed resets every morning."
        },
        {
            icon: <Shield className="text-primary" size={20} />,
            title: "Secure Login",
            description: "One-tap OAuth via Google or GitHub. Built on Supabase with Row Level Security. Authenticated effortlessly."
        },
        {
            icon: <Trash2 className="text-primary" size={20} />,
            title: "Zero Clutter",
            description: "No clout chasing, no permanent history. Start every day with a clean slate."
        },
        {
            icon: <Gamepad2 className="text-primary" size={20} />,
            title: "Genjutsu Play",
            description: "Challenge friends to online multiplayer games — Chess, Tic-Tac-Toe, Rock Paper Scissors, and more. All live, all inside the platform."
        },
        {
            icon: <Ghost className="text-primary" size={20} />,
            title: "Whispers",
            description: "Ephemeral direct messages that also vanish after 24 hours. Say what you mean. Leave no paper trail."
        },
        {
            icon: <Share2 className="text-primary" size={20} />,
            title: "Dynamic OG Images",
            description: "Auto-generated open graph images for better social sharing across platforms."
        },
        {
            icon: <Smartphone className="text-primary" size={20} />,
            title: "TWA (Native Android)",
            description: "Experience genjutsu as a native Android app. Fast, immersive, and built with Trusted Web Activity technology.",
            downloadUrl: "https://github.com/iamovi/genjutsu/releases/download/version2/genjutsu.apk"
        },
        {
            icon: <MessageCircle className="text-primary" size={20} />,
            title: "Community Chat",
            description: "A built-in space to report bugs, suggest features, talk about the app, or just connect. Admins are always there. Say anything, anytime."
        },
        {
            icon: <UsersRound className="text-primary" size={20} />,
            title: "Genjutsu Stranger",
            description: "Meet fellow developers securely and entirely anonymously via real-time WebSockets. A judgment-free zone to converse."
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
                                        {'downloadUrl' in feature && (
                                            <a
                                                href={feature.downloadUrl as string}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="gum-btn bg-primary text-primary-foreground text-[10px] px-3 py-1.5 flex items-center gap-1.5 w-fit mt-4 hover:opacity-90 transition-opacity"
                                            >
                                                <Download size={14} />
                                                Download APK
                                            </a>
                                        )}
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

                            {/* Open Source & Contributors Section */}
                            <section className="mt-12 mb-4 text-foreground">
                                <p className="text-xs font-mono uppercase tracking-widest text-primary/70 mb-6 border-l-2 border-primary/50 pl-3">// Open Source &amp; Contributors</p>
                                <div className="gum-card p-6 md:p-8">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-8 border-b border-border">
                                        <div>
                                            <h3 className="text-2xl font-bold uppercase tracking-tight mb-2">Open Source</h3>
                                            <p className="text-sm text-foreground/80 font-medium max-w-xl leading-relaxed">
                                                Built for the developer community. Fix a bug, suggest a feature, or help with the manga-inspired design.
                                                Every migration, RLS policy, and cron job is in the repo. Let's build something ephemeral together.
                                            </p>
                                        </div>
                                        <a href="https://github.com/iamovi/genjutsu" target="_blank" rel="noopener noreferrer"
                                            className="gum-btn bg-primary text-primary-foreground inline-flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-wide text-sm whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity">
                                            <Github size={20} />
                                            View on GitHub
                                        </a>
                                    </div>

                                    <p className="text-xs font-mono uppercase tracking-widest text-primary/70 mb-6 border-l-2 border-primary/50 pl-3">// Author &amp; Contributors</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {isLoadingContributors ? (
                                            Array.from({ length: 6 }).map((_, i) => (
                                                <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                                                    <div className="w-14 h-14 rounded-[3px] bg-secondary"></div>
                                                    <div className="h-2 w-12 rounded bg-secondary"></div>
                                                </div>
                                            ))
                                        ) : contributors?.map((c: any, i: number) => (
                                            <a key={c.id || c.login} href={c.html_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group p-2 rounded-[3px] hover:bg-secondary/50 transition-colors">
                                                <div className="relative">
                                                    {i === 0 && <div className="absolute -top-2 -right-3 z-10 bg-primary text-primary-foreground px-1 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-[2px] whitespace-nowrap">Author</div>}
                                                    <img src={c.avatar_url} alt={c.login} className="w-14 h-14 rounded-[3px] gum-border object-cover group-hover:opacity-80 transition-opacity" />
                                                </div>
                                                <span className="text-xs font-mono font-bold uppercase tracking-tight text-center truncate w-full group-hover:text-primary transition-colors">{c.login}</span>
                                                <span className="text-[10px] font-mono text-muted-foreground">{c.contributions} commit{c.contributions !== 1 ? 's' : ''}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
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
