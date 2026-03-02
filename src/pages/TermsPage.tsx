import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { Eye, ShieldAlert, Gavel, UserX, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const TermsPage = () => {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>Terms & Rules — genjutsu</title>
                <meta name="description" content="The ground rules for participating in the genjutsu developer community." />
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
                            <img src="/fav.jpg" alt="genjutsu" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-4xl font-bold tracking-tighter">Terms of Service</h1>
                        <p className="text-muted-foreground mt-2">The simple rules of the genjutsu world.</p>
                    </div>

                    <div className="gum-card p-10 space-y-8 prose prose-invert max-w-none">
                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Gavel className="text-primary" size={24} />
                                <h2 className="text-2xl font-bold m-0">1. Play Nice</h2>
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground mt-2">
                                genjutsu is a place for developers to share what they are building. We don't tolerate harassment, hate speech, or spam. If you act like a bot or a bully, we'll remove your account. No warnings.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="text-primary" size={24} />
                                <h2 className="text-2xl font-bold m-0">2. Code & Content</h2>
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground mt-2">
                                You own what you post. However, keep in mind everything is deleted after 24 hours. We are not responsible for lost snippets. Back them up if they're important! Don't post content that isn't yours to share.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <UserX className="text-primary" size={24} />
                                <h2 className="text-2xl font-bold m-0">3. Termination</h2>
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground mt-2">
                                We reserve the right to ban any account for any reason. If we think your existence on genjutsu is harming the community, you're out. Simple as that.
                            </p>
                        </section>

                        <div className="pt-8 border-t border-secondary text-xs text-muted-foreground text-center">
                            Last Updated: March 2026. These terms live for as long as we feel like it.
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default TermsPage;
