import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const PrivacyPage = () => {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>Privacy Policy — Vanishing Data</title>
                <meta name="description" content="What happens on genjutsu, stays here (for 24 hours). No permanent traces." />
            </Helmet>
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 py-12">
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

                    <div className="text-center">
                        <div className="w-16 h-16 rounded-[3px] gum-border overflow-hidden mx-auto mb-6">
                            <img src="/fav.webp" alt="genjutsu" width={64} height={64} loading="lazy" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-4xl font-bold tracking-tighter">Privacy Policy</h1>
                        <p className="text-muted-foreground mt-2">What happens on genjutsu, stays here (for 24 hours).</p>
                    </div>

                    <div className="gum-card p-10 space-y-8 prose dark:prose-invert max-w-none">
                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Trash2 className="text-primary" size={24} />
                                <h2 className="text-2xl font-bold m-0 text-foreground">1. Total Deletion</h2>
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground mt-2 underline decoration-primary/40 underline-offset-4 decoration-2">
                                Your privacy is our priority. Every post you create is automatically deleted from our production database exactly 24 hours after creation.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <EyeOff className="text-primary" size={24} />
                                <h2 className="text-2xl font-bold m-0 text-foreground">2. Data Minimalists</h2>
                            </div>
                            <p className="text-sm leading-relaxed text-foreground/70 mt-2">
                                We only collect what we need to run genjutsu: your email, your chosen username, and a hashed password. We don't sell your data to anyone. We don't track your every move across the web.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Lock className="text-primary" size={24} />
                                <h2 className="text-2xl font-bold m-0 text-foreground">3. Security</h2>
                            </div>
                            <p className="text-sm leading-relaxed text-foreground/70 mt-2">
                                We use industry-standard encryption for your credentials. However, no database is 100% immune to hacks. We keep things minimal to minimize risk.
                            </p>
                        </section>

                        <div className="pt-8 border-t border-secondary text-xs text-muted-foreground text-center">
                            By using genjutsu, you agree to these simple privacy terms.
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default PrivacyPage;
