import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { motion } from "framer-motion";
import { Eye, Code, Zap, Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const AboutPage = () => {
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
                        className="space-y-4"
                    >
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-3 py-1.5 gum-card bg-secondary text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-colors w-fit"
                        >
                            <ArrowLeft size={14} />
                            Back to Home
                        </Link>

                        <div className="gum-card p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-[3px] gum-border overflow-hidden">
                                    <img src="/fav.jpg" alt="genjutsu" className="w-full h-full object-cover" />
                                </div>
                                <h1 className="text-3xl font-bold tracking-tight">About genjutsu</h1>
                            </div>

                            <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
                                <p>
                                    <span className="font-bold text-lg">genjutsu</span> is a social platform built for the modern developer who values focus over clutter. In a world of permanent digital footprints, we believe in the power of the moment.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                                    <div className="gum-card p-4 border-primary/20">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Zap className="text-primary" size={18} />
                                            <h3 className="font-bold">24-Hour Life</h3>
                                        </div>
                                        <p className="text-muted-foreground">Every post lives for exactly 24 hours. No archives, no regrets. Just what's happening right now in the dev world.</p>
                                    </div>
                                    <div className="gum-card p-4 border-primary/20">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Code className="text-primary" size={18} />
                                            <h3 className="font-bold">Code First</h3>
                                        </div>
                                        <p className="text-muted-foreground">Built by developers, for developers. Share snippets, talk tech, and connect with builders globally.</p>
                                    </div>
                                </div>

                                <div className="mt-8 space-y-4">
                                    <h2 className="text-xl font-bold">Why "genjutsu"?</h2>
                                    <p>
                                        Derived from Japanese (幻術 - "Genjutsu" or "Illusionary Arts"), genjutsu represents the transient nature of our digital experiences. Every post is an illusion—vivid and powerful in the moment, but destined to vanish.
                                    </p>
                                </div>

                                <div className="mt-12 pt-8 border-t border-secondary">
                                    <p className="text-muted-foreground">
                                        Created by <a href="https://iamovi.github.io/" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline decorative-underline decoration-2">Ovi</a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="hidden lg:block">
                        <Sidebar />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AboutPage;
