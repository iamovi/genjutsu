import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { EyeOff, Lock, Trash2, ArrowLeft, Image, KeyRound, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const PrivacyPage = () => {
    const sections = [
        {
            icon: <Trash2 className="text-primary" size={20} />,
            title: "1. Ephemeral Purge (24h Lifespan)",
            description: "Every post, comment, direct message (Whisper), and uploaded image is automatically deleted from our Supabase production database exactly 24 hours after creation. Deletion is absolute and permanent."
        },
        {
            icon: <EyeOff className="text-primary" size={20} />,
            title: "2. Data Minimalism",
            description: "We only store what is required to authenticate you: your email, username, and profile picture URL from Google or GitHub. We run zero tracking cookies, marketing trackers, or telemetry scripts."
        },
        {
            icon: <Image className="text-primary" size={20} />,
            title: "3. Media & Compression",
            description: "Images uploaded for posts or profile albums are processed and compressed directly inside your browser (client-side) before transmission to prevent metadata leakage and save bandwidth."
        },
        {
            icon: <MessageSquare className="text-primary" size={20} />,
            title: "4. Anonymous Q&A & Stranger Chats",
            description: "Anonymous questions sent to your public Q&A link, and WebSocket connections created in Stranger Chat, do not log IP addresses, browser fingerprints, or geographical data."
        },
        {
            icon: <KeyRound className="text-primary" size={20} />,
            title: "5. Local App Lock & PIN",
            description: "If you enable the App Lock PIN, the hash of your PIN is stored exclusively inside your browser's localStorage. It is never transmitted, processed, or backed up to our servers."
        },
        {
            icon: <Lock className="text-primary" size={20} />,
            title: "6. Security & Infrastructure",
            description: "Our database is hosted securely via Supabase with strict Row-Level Security (RLS) policies. However, since no system is fully immune, we mitigate risk by keeping zero permanent archives."
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>Privacy Policy — genjutsu</title>
                <meta name="description" content="What happens on genjutsu, stays here (for 24 hours). No permanent traces." />
            </Helmet>
            <Navbar />
            <main className="max-w-4xl mx-auto px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-12"
                >
                    <div>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-bold transition-colors mb-6 group"
                        >
                            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                            Back to Home
                        </Link>
                        
                        <div className="space-y-2">
                            <span className="text-xs uppercase tracking-widest text-primary font-bold">// Privacy Policy</span>
                            <h1 className="text-4xl font-extrabold tracking-tight">The Art of Vanishing Data</h1>
                            <p className="text-muted-foreground text-sm max-w-xl">
                                We design systems that forget. Learn how we handle your ephemeral session data, messages, and security.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {sections.map((section, index) => (
                            <motion.div
                                key={section.title}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="space-y-1.5"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-primary shrink-0">{section.icon}</span>
                                    <h2 className="font-bold text-base text-foreground m-0">{section.title}</h2>
                                </div>
                                <p className="text-sm text-foreground/70 leading-relaxed pl-7">
                                    {section.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-border/40 text-[11px] text-muted-foreground">
                        By using genjutsu, you agree to this simple privacy layout. Everything decays. Last updated: May 2026.
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default PrivacyPage;
