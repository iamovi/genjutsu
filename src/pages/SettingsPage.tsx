import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import Navbar from "@/components/Navbar";
import { LogOut, ArrowLeft, Shield, Settings, Check, Loader2, AtSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SettingsPage = () => {
    const { user, signOut, isAdmin } = useAuth();
    const { profile, changeUsername, getNextUsernameChangeDate, deleteAccount } = useProfile();
    const navigate = useNavigate();

    const [newUsername, setNewUsername] = useState("");
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "danger">("general");
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // Initialize input with current username
    useEffect(() => {
        if (profile?.username) {
            setNewUsername(profile.username);
        }
    }, [profile?.username]);

    // Handle session expiration or manual logout
    useEffect(() => {
        if (!user) {
            navigate("/auth");
        }
    }, [user, navigate]);

    const validateUsername = (value: string): string | null => {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return "Username is required";
        if (normalized.length < 3) return "Must be at least 3 characters";
        if (normalized.length > 20) return "Must be 20 characters or less";
        if (!/^[a-z0-9_]+$/.test(normalized)) return "Only lowercase letters, numbers, and underscores";
        return null;
    };

    const handleUsernameChange = (value: string) => {
        const lower = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
        setNewUsername(lower);
        setUsernameError(validateUsername(lower));
    };

    const handleSaveUsername = async () => {
        const validationError = validateUsername(newUsername);
        if (validationError) {
            setUsernameError(validationError);
            return;
        }

        setIsSaving(true);
        const { error } = await changeUsername(newUsername);
        setIsSaving(false);

        if (error) {
            setUsernameError(error);
            toast.error(error);
        } else {
            setUsernameError(null);
            toast.success("Username updated!");
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            toast.success("Signed out successfully");
            navigate("/auth");
        } catch (error) {
            toast.error("Failed to sign out");
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== profile?.username) return;

        setIsDeleting(true);
        const { error } = await deleteAccount();
        setIsDeleting(false);

        if (error) {
            toast.error(error);
        } else {
            toast.success("Account permanently deleted");
            navigate("/auth");
        }
    };

    if (!user) {
        return null;
    }

    const isUsernameChanged = newUsername !== (profile?.username || "");
    const cooldownUntil = getNextUsernameChangeDate();
    const isOnCooldown = !!cooldownUntil;
    const canSave = isUsernameChanged && !usernameError && !isSaving && !isOnCooldown;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>Settings — genjutsu</title>
            </Helmet>
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <button
                            onClick={() => navigate("/")}
                            className="p-2 gum-card bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
                        <aside className="space-y-1">
                            <button
                                onClick={() => setActiveTab("general")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "general"
                                    ? "bg-primary text-primary-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground font-medium"
                                    }`}
                            >
                                <Settings size={18} />
                                General
                            </button>
                            <button
                                onClick={() => setActiveTab("danger")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "danger"
                                    ? "bg-destructive text-destructive-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive font-medium"
                                    }`}
                            >
                                <Shield size={18} />
                                Danger Zone
                            </button>
                        </aside>

                        <div className="space-y-6">
                            <AnimatePresence mode="wait">
                                {activeTab === "general" && (
                                    <motion.div
                                        key="general"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        {/* Account Info */}
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-lg font-bold mb-4">Account</h2>
                                                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-[3px] border border-border/50">
                                                    <div>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Signed in as</p>
                                                        <p className="font-bold">{profile?.display_name || user.email}</p>
                                                        <p className="text-sm text-muted-foreground">@{profile?.username || "user"}</p>
                                                    </div>
                                                    <div className="w-12 h-12 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-lg overflow-hidden">
                                                        {profile?.avatar_url ? (
                                                            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                                                        ) : (profile?.display_name?.[0] || "?")}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Change Username */}
                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1">Change Username</h2>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    Your profile URL will update to <span className="font-mono text-foreground">genjutsu-social.vercel.app/u/{newUsername || "..."}</span>
                                                </p>
                                                {isOnCooldown && (
                                                    <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-[3px] text-sm">
                                                        <p className="font-bold text-destructive">🔒 Username change on cooldown</p>
                                                        <p className="text-muted-foreground text-xs mt-1">
                                                            You can change your username again on{" "}
                                                            <span className="font-mono text-foreground">
                                                                {cooldownUntil!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                            </span>
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <div className="flex-1 relative">
                                                        <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                        <input
                                                            type="text"
                                                            value={newUsername}
                                                            onChange={(e) => handleUsernameChange(e.target.value)}
                                                            maxLength={20}
                                                            disabled={isOnCooldown}
                                                            id="new-username"
                                                            name="username"
                                                            autoComplete="username"
                                                            className={`w-full pl-9 pr-4 py-2.5 bg-background border-2 rounded-[3px] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${usernameError
                                                                ? "border-destructive"
                                                                : isUsernameChanged && !usernameError
                                                                    ? "border-green-500"
                                                                    : "border-border"
                                                                }`}
                                                            placeholder={profile?.username || "username"}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleSaveUsername}
                                                        disabled={!canSave}
                                                        className="gum-btn bg-primary text-primary-foreground text-sm px-6 py-2.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                                    >
                                                        {isSaving ? (
                                                            <Loader2 size={16} className="animate-spin" />
                                                        ) : (
                                                            <Check size={16} />
                                                        )}
                                                        {isSaving ? "Saving..." : "Save"}
                                                    </button>
                                                </div>
                                                {usernameError && (
                                                    <p className="text-xs text-destructive mt-2 font-medium">{usernameError}</p>
                                                )}
                                                {isUsernameChanged && !usernameError && (
                                                    <p className="text-xs text-green-500 mt-2 font-medium">Looks good!</p>
                                                )}
                                                <p className="text-[11px] text-muted-foreground mt-2">
                                                    3–20 characters. Lowercase letters, numbers, and underscores only.
                                                </p>
                                            </div>

                                            {/* Log Out Section */}
                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1">Exit Session</h2>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    Ready to step out of the illusion? You can sign back in at any time.
                                                </p>
                                                <button
                                                    onClick={handleSignOut}
                                                    className="gum-btn border-2 border-foreground bg-secondary hover:bg-secondary/80 flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold w-full sm:w-auto"
                                                >
                                                    <LogOut size={18} />
                                                    Log Out of Genjutsu
                                                </button>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "danger" && (
                                    <motion.div
                                        key="danger"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6">
                                            <h2 className="text-lg font-bold mb-2 text-destructive uppercase tracking-tight">Danger Zone</h2>
                                            <p className="text-sm text-muted-foreground mb-6">
                                                The following actions are destructive and cannot be undone. Be careful.
                                            </p>

                                            <div className="space-y-4">
                                                <h3 className="text-base font-bold text-destructive mb-2 uppercase tracking-tight">Delete Account Permanently</h3>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    This action is irreversible. All your posts, whispers, reacts, and your profile metadata will be erased forever.
                                                </p>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <button
                                                            className="gum-btn bg-destructive hover:bg-destructive/90 text-white w-full sm:w-auto font-bold flex items-center justify-center gap-2"
                                                        >
                                                            <Shield size={18} className="animate-pulse" />
                                                            Exterminate Account
                                                        </button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="gum-card border-destructive/50">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-destructive flex items-center gap-2">
                                                                <Shield size={20} />
                                                                Are you absolutely sure?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription asChild className="space-y-3">
                                                                <div>
                                                                    <p>
                                                                        This illusion is final. Everything linked to <span className="font-mono font-bold text-foreground">@{profile?.username}</span> will vanish from the genjutsu.
                                                                    </p>
                                                                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-[3px]">
                                                                        <p className="text-xs font-bold text-destructive uppercase tracking-widest mb-1">To confirm, type your username:</p>
                                                                        <input
                                                                            id="delete-confirm"
                                                                            name="delete-confirm"
                                                                            type="text"
                                                                            autoFocus
                                                                            placeholder={profile?.username}
                                                                            className="w-full bg-background border-2 border-destructive/30 rounded-[3px] px-3 py-2 text-sm font-mono focus:outline-none focus:border-destructive transition-colors"
                                                                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="rounded-[3px]">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                disabled={deleteConfirmation !== profile?.username || isDeleting}
                                                                onClick={handleDeleteAccount}
                                                                className="bg-destructive text-white hover:bg-destructive/90 rounded-[3px] font-bold"
                                                            >
                                                                {isDeleting ? (
                                                                    <Loader2 size={16} className="animate-spin mr-2" />
                                                                ) : null}
                                                                Final Destruction
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <p className="text-center text-xs text-muted-foreground mt-8">
                                genjutsu — everything vanishes.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default SettingsPage;
