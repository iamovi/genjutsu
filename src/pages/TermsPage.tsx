import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { Gavel, ShieldAlert, UserX, ArrowLeft, Swords, Ban, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const TermsPage = () => {
    const sections = [
        {
            icon: <Gavel className="text-primary" size={20} />,
            title: "1. Play Nice (Community Guidelines)",
            description: "genjutsu is a sanctuary for developers. Harassment, toxic behavior, hate speech, and spam are strictly prohibited. Be respectful, share what you build, and support the community."
        },
        {
            icon: <ShieldAlert className="text-primary" size={20} />,
            title: "2. Snippet & Media Ownership",
            description: "You own what you post. However, keep in mind everything decays after 24 hours. We are not responsible for lost snippets or media. Back up anything important beforehand."
        },
        {
            icon: <Swords className="text-primary" size={20} />,
            title: "3. Ephemeral Gameplay & Conduct",
            description: "When playing online multiplayer games or submitting HTML5 mini-games to the Game House, you agree not to use exploits, cheats, or upload games containing malicious code."
        },
        {
            icon: <Ban className="text-primary" size={20} />,
            title: "4. Abuse & API Exploitation",
            description: "Attempting to scrape the public feed, spam WebSocket channels, bypass the 24-hour purge CRON jobs, or brute-force account/MFA gates is an automatic ground for restriction."
        },
        {
            icon: <UserX className="text-primary" size={20} />,
            title: "5. Absolute Termination",
            description: "We reserve the right to restrict access, delete credentials, or ban any account without prior notice if they pose a threat to the community's stability or user safety."
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>Terms & Rules — genjutsu</title>
                <meta name="description" content="The ground rules for participating in the genjutsu developer community." />
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
                            <span className="text-xs uppercase tracking-widest text-primary font-bold">// Terms of Service</span>
                            <h1 className="text-4xl font-extrabold tracking-tight">The Rules of the Illusion</h1>
                            <p className="text-muted-foreground text-sm max-w-xl">
                                Simple rules for a self-cleaning world. Play fair, write clean code, and respect the ephemeral nature of the platform.
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
                        Last updated: May 2026. These terms govern the genjutsu platform. Abuse the rules, and you leave the illusion.
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default TermsPage;
