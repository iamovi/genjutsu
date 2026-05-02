import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { LogOut, ArrowLeft, Shield, Settings, Check, AtSign, Globe, Palette, Moon, Sun, Monitor, Pipette, WandSparkles, Music, Volume2, VolumeX, Clock, Lock, Eye, EyeOff, ImageOff, KeyRound, Layout, Type, Square, Grid, Bell, BellOff, Smile } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTheme, type ThemePreset } from "@/components/theme-provider";
import TwemojiText from "@/components/TwemojiText";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { hashPin, verifyPin, APP_LOCK_HASH_KEY, APP_LOCK_SESSION_KEY, APP_LOCK_Q1_KEY, APP_LOCK_Q2_KEY, APP_LOCK_A1_HASH_KEY, APP_LOCK_A2_HASH_KEY, PREDEFINED_QUESTIONS, formatAnswer } from "@/lib/pin";
import { usePushNotifications } from "@/hooks/usePushNotifications";
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

type MfaSetupState = {
    factorId: string;
    qrCode: string;
    secret: string;
    uri: string;
};

const buildQrImageSrc = (qrCode: string) => {
    const normalized = qrCode.trim();
    if (!normalized) return "";

    if (normalized.startsWith("data:image/")) return normalized;
    if (normalized.startsWith("<svg") || normalized.startsWith("<?xml")) {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`;
    }

    const maybeBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(normalized);
    if (maybeBase64) {
        return `data:image/svg+xml;base64,${normalized.replace(/\s+/g, "")}`;
    }

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`;
};

const SettingsPage = () => {
    const { user, signOut, isAdmin } = useAuth();
    const { profile, changeUsername, getNextUsernameChangeDate, deleteAccount } = useProfile();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { theme, preset, color, customColor, font, radius, emojiPack, animateColor, cursorTrail, grid, dataSaver, soundEnabled, shadowWalk, setTheme, setPreset, setColor, setCustomColor, setFont, setRadius, setEmojiPack, setAnimateColor, setCursorTrail, setGrid, setDataSaver, setSoundEnabled, setShadowWalk } = useTheme();
    const pushNotifications = usePushNotifications();
    const [mfaStatusLoading, setMfaStatusLoading] = useState(false);
    const [mfaStatusReady, setMfaStatusReady] = useState(false);
    const [mfaStatusError, setMfaStatusError] = useState<string | null>(null);
    const [mfaActionLoading, setMfaActionLoading] = useState(false);
    const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
    const [mfaAalLevel, setMfaAalLevel] = useState<"aal1" | "aal2" | null>(null);
    const [mfaSetup, setMfaSetup] = useState<MfaSetupState | null>(null);
    const [mfaCode, setMfaCode] = useState("");

    const [newUsername, setNewUsername] = useState("");
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "language" | "appearance" | "data" | "audio" | "security" | "notifications" | "danger">("general");
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // App Lock state
    const [appLockEnabled, setAppLockEnabled] = useState(() => !!localStorage.getItem(APP_LOCK_HASH_KEY));
    const [pinStep, setPinStep] = useState<"idle" | "set-new" | "confirm-new" | "security-questions" | "verify-current" | "change-new" | "change-confirm">("idle");
    const [pinValue, setPinValue] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [pinError, setPinError] = useState<string | null>(null);
    const [pinSaving, setPinSaving] = useState(false);

    // Security Questions state
    const [q1, setQ1] = useState(PREDEFINED_QUESTIONS[0]);
    const [q2, setQ2] = useState(PREDEFINED_QUESTIONS[1]);
    const [a1, setA1] = useState("");
    const [a2, setA2] = useState("");

    const [dangerUnlockedSession, setDangerUnlockedSession] = useState(false);
    const [dangerTimeLeft, setDangerTimeLeft] = useState<number>(0);

    const getDangerLockTime = useCallback(() => {
        if (!user) return 0;
        const stored = localStorage.getItem(`genjutsu-danger-lock-${user.id}`);
        return stored ? parseInt(stored) : 0;
    }, [user]);

    const handleDangerClick = () => {
        if (!user) return;
        const lockedUntil = getDangerLockTime();
        if (Date.now() < lockedUntil) {
            setDangerUnlockedSession(false);
        } else {
            const newLock = Date.now() + 60 * 60 * 1000;
            localStorage.setItem(`genjutsu-danger-lock-${user.id}`, newLock.toString());
            setDangerUnlockedSession(true);
        }
        setActiveTab("danger");
    };

    useEffect(() => {
        if (activeTab !== "danger" || dangerUnlockedSession) return;
        
        const interval = setInterval(() => {
            const lockedUntil = getDangerLockTime();
            const diff = lockedUntil - Date.now();
            if (diff <= 0) {
                setDangerTimeLeft(0);
                clearInterval(interval);
            } else {
                setDangerTimeLeft(diff);
            }
        }, 1000);
        
        const initDiff = getDangerLockTime() - Date.now();
        setDangerTimeLeft(initDiff > 0 ? initDiff : 0);

        return () => clearInterval(interval);
    }, [activeTab, dangerUnlockedSession, getDangerLockTime]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

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

    // Preload available fonts to ensure preview buttons render them correctly
    useEffect(() => {
        const fonts = ['Inter', 'Space Grotesk', 'Fira Code', 'JetBrains Mono', 'Comic Neue'];
        fonts.forEach(f => {
            const fontName = f.replace(/ /g, "+");
            const linkId = `preview-font-${fontName}`;
            if (!document.getElementById(linkId)) {
                const link = document.createElement("link");
                link.id = linkId;
                link.rel = "stylesheet";
                link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
                document.head.appendChild(link);
            }
        });
    }, []);

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

    const handlePresetChange = (nextPreset: ThemePreset) => {
        setPreset(nextPreset);
        setAnimateColor(false);

        if (nextPreset === "default") {
            setColor("purple");
            setCustomColor("#8b5cf6");
            setFont("Reddit Mono");
            setRadius("default");
            setGrid("blueprint");
            return;
        }

        if (nextPreset === "minecraft") {
            setColor("custom");
            setCustomColor("#6ea24a");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "win95") {
            setColor("custom");
            setCustomColor("#008080");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "papyrus") {
            setColor("custom");
            setCustomColor("#7c2d12");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "hackernews") {
            setColor("custom");
            setCustomColor("#ff6600");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "winxp") {
            setColor("custom");
            setCustomColor("#0055e5");
            setRadius("md");
            setGrid("none");
            return;
        }


        if (nextPreset === "gameboy") {
            setColor("custom");
            setCustomColor("#306230");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "nord") {
            setColor("custom");
            setCustomColor("#88c0d0");
            setRadius("md");
            setGrid("none");
            return;
        }

        if (nextPreset === "terminal") {
            setColor("custom");
            setCustomColor("#00ff41");
            setRadius("none");
            setGrid("scanlines");
            setFont("Reddit Mono");
            return;
        }

        if (nextPreset === "nature") {
            setColor("custom");
            setCustomColor("#2DB361");
            setRadius("full");
            setGrid("none");
            setFont("Inter");
            return;
        }
    };

    const loadMfaStatus = useCallback(async () => {
        if (!user) return;

        setMfaStatusLoading(true);
        setMfaStatusReady(false);
        setMfaStatusError(null);
        try {
            const [{ data: factorsData, error: factorsError }, { data: aalData, error: aalError }] = await Promise.all([
                supabase.auth.mfa.listFactors(),
                supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
            ]);

            if (factorsError) throw factorsError;
            if (aalError) throw aalError;

            const totpFactor = factorsData?.totp?.[0] ?? null;
            setMfaFactorId(totpFactor?.id ?? null);
            setMfaAalLevel((aalData?.currentLevel as "aal1" | "aal2" | null) ?? null);
            setMfaStatusReady(true);
        } catch (error: any) {
            console.error("Failed to load MFA status:", error);
            toast.error("Couldn't load authenticator status.");
            setMfaStatusError("Couldn't load authenticator status.");
            setMfaFactorId(null);
            setMfaAalLevel(null);
        } finally {
            setMfaStatusLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === "security") {
            void loadMfaStatus();
        }
    }, [activeTab, loadMfaStatus]);

    const handleStartMfaSetup = async () => {
        if (!mfaStatusReady || mfaStatusLoading || mfaActionLoading || !!mfaSetup) return;
        if (mfaFactorId) {
            toast.message("Authenticator app is already enabled.");
            return;
        }

        setMfaActionLoading(true);
        try {
            const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();
            if (listError) throw listError;

            const staleUnverifiedTotp = (factorsData?.all ?? []).filter(
                (factor) => factor.factor_type === "totp" && factor.status === "unverified"
            );

            for (const factor of staleUnverifiedTotp) {
                const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
                if (error) {
                    console.warn("Failed to clean stale unverified MFA factor:", error.message);
                }
            }

            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: "Genjutsu Authenticator",
            });

            if (error) throw error;
            if (!data?.totp?.qr_code) throw new Error("Authenticator setup data is missing.");

            setMfaSetup({
                factorId: data.id,
                qrCode: data.totp.qr_code,
                secret: data.totp.secret,
                uri: data.totp.uri,
            });
            setMfaCode("");
            toast.success("Scan the QR code and enter your 6-digit code.");
        } catch (error: any) {
            console.error("Failed to start MFA setup:", error);
            toast.error(error?.message || "Couldn't start authenticator setup.");
        } finally {
            setMfaActionLoading(false);
        }
    };

    const handleCancelMfaSetup = async () => {
        if (!mfaSetup) return;

        setMfaActionLoading(true);
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaSetup.factorId });
            if (error) throw error;
        } catch (error) {
            console.warn("Failed to clean up unverified MFA factor:", error);
        } finally {
            setMfaSetup(null);
            setMfaCode("");
            setMfaActionLoading(false);
        }
    };

    const handleVerifyMfaSetup = async () => {
        if (!mfaSetup || mfaCode.length !== 6) return;

        setMfaActionLoading(true);
        try {
            const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: mfaSetup.factorId,
                code: mfaCode,
            });

            if (error) throw error;

            toast.success("Authenticator app enabled.");
            setMfaSetup(null);
            setMfaCode("");
            await loadMfaStatus();
        } catch (error: any) {
            console.error("Failed to verify MFA setup:", error);
            toast.error(error?.message || "Invalid code. Please try again.");
        } finally {
            setMfaActionLoading(false);
        }
    };

    const handleDisableMfa = async () => {
        if (!mfaStatusReady || mfaStatusLoading || !mfaFactorId) return;

        setMfaActionLoading(true);
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
            if (error) throw error;

            toast.success("Authenticator app disabled.");
            setMfaFactorId(null);
            setMfaAalLevel("aal1");
            await loadMfaStatus();
        } catch (error: any) {
            console.error("Failed to disable MFA:", error);
            const message = String(error?.message || "").toLowerCase();
            if (message.includes("aal2")) {
                toast.error("Re-authenticate with 2FA before disabling it.");
            } else {
                toast.error(error?.message || "Couldn't disable authenticator.");
            }
        } finally {
            setMfaActionLoading(false);
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
                <title>{t("settings.title")} — genjutsu</title>
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
                        <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
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
                                {t("settings.general")}
                            </button>
                            <button
                                onClick={() => setActiveTab("language")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "language"
                                    ? "bg-primary text-primary-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground font-medium"
                                    }`}
                            >
                                <Globe size={18} />
                                {t("settings.language")}
                            </button>
                            <button
                                onClick={() => setActiveTab("appearance")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "appearance"
                                    ? "bg-primary text-primary-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground font-medium"
                                    }`}
                            >
                                <Palette size={18} />
                                {t("settings.appearance", "Appearance")}
                            </button>
                            <button
                                onClick={() => setActiveTab("data")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "data"
                                    ? "bg-primary text-primary-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground font-medium"
                                    }`}
                            >
                                <ImageOff size={18} />
                                Data Saving
                            </button>
                            <button
                                onClick={() => setActiveTab("audio")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "audio"
                                    ? "bg-primary text-primary-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground font-medium"
                                    }`}
                            >
                                <Music size={18} />
                                Sound
                            </button>
                            <button
                                onClick={() => setActiveTab("security")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "security"
                                    ? "bg-primary text-primary-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground font-medium"
                                    }`}
                            >
                                <KeyRound size={18} />
                                Security
                            </button>
                            <button
                                onClick={() => setActiveTab("notifications")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "notifications"
                                    ? "bg-primary text-primary-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground font-medium"
                                    }`}
                            >
                                <Bell size={18} />
                                Notifications
                            </button>
                            <button
                                onClick={handleDangerClick}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm transition-all ${activeTab === "danger"
                                    ? "bg-destructive text-destructive-foreground font-bold gum-shadow-sm"
                                    : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive font-medium"
                                    }`}
                            >
                                <Shield size={18} />
                                {t("settings.dangerZone")}
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
                                                <h2 className="text-lg font-bold mb-4">{t("settings.account")}</h2>
                                                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-[3px] border border-border/50">
                                                    <div>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("settings.signedInAs")}</p>
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
                                                <h2 className="text-lg font-bold mb-1">{t("settings.changeUsername")}</h2>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {t("settings.changeUsernameDesc")} <span className="font-mono text-foreground">genjutsu-social.vercel.app/u/{newUsername || "..."}</span>
                                                </p>
                                                {isOnCooldown && (
                                                    <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-[3px] text-sm">
                                                        <p className="font-bold text-destructive">🔒 {t("settings.usernameCooldown")}</p>
                                                        <p className="text-muted-foreground text-xs mt-1">
                                                            {t("settings.usernameCooldownDesc")}{" "}
                                                            <span className="font-mono text-foreground">
                                                                {cooldownUntil!.toLocaleDateString(i18n.language, { month: "short", day: "numeric", year: "numeric" })}
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
                                                            <FrogLoader size={16} className="" />
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
                                                <h2 className="text-lg font-bold mb-1">{t("settings.exitSession")}</h2>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {t("settings.exitSessionDesc")}
                                                </p>
                                                <button
                                                    onClick={handleSignOut}
                                                    className="gum-btn border-2 border-foreground bg-secondary hover:bg-secondary/80 flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold w-full sm:w-auto"
                                                >
                                                    <LogOut size={18} />
                                                    {t("settings.logOut")}
                                                </button>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "language" && (
                                    <motion.div
                                        key="language"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-lg font-bold mb-1">{t("settings.language")}</h2>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {t("settings.languageDesc")}
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    <button
                                                        onClick={() => i18n.changeLanguage('en')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('en') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        English
                                                    </button>
                                                    <button
                                                        onClick={() => i18n.changeLanguage('bn')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('bn') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        বাংলা
                                                    </button>
                                                    <button
                                                        onClick={() => i18n.changeLanguage('ja')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('ja') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        日本語
                                                    </button>
                                                    <button
                                                        onClick={() => i18n.changeLanguage('fil')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('fil') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        Tagalog
                                                    </button>
                                                    <button
                                                        onClick={() => i18n.changeLanguage('hi')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('hi') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        हिंदी
                                                    </button>
                                                    <button
                                                        onClick={() => i18n.changeLanguage('es')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('es') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        Español
                                                    </button>
                                                    <button
                                                        onClick={() => i18n.changeLanguage('pt')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('pt') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        Português
                                                    </button>
                                                    <button
                                                        onClick={() => i18n.changeLanguage('ko')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('ko') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        한국어
                                                    </button>
                                                    <button
                                                        onClick={() => i18n.changeLanguage('ru')}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith('ru') ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        Русский
                                                    </button>
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "appearance" && (
                                    <motion.div
                                        key="appearance"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Palette size={18} className="text-primary" /> Theme Presets</h2>
                                                <p className="text-sm text-muted-foreground mb-4">Apply a complete look in one click, then fine-tune below.</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => handlePresetChange("default")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "default" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Default</p>
                                                        <p className={`text-xs mt-1 ${preset === "default" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Current Genjutsu style</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("minecraft")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "minecraft" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Minecraft</p>
                                                        <p className={`text-xs mt-1 ${preset === "minecraft" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Blocky earth tones and pixel-style mood</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("win95")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "win95" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Windows 95</p>
                                                        <p className={`text-xs mt-1 ${preset === "win95" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Classic PC aesthetic with 3D beveled edges</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("papyrus")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "papyrus" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Papyrus/Ink</p>
                                                        <p className={`text-xs mt-1 ${preset === "papyrus" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Old manuscript with parchment texture</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("hackernews")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "hackernews" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Hacker News</p>
                                                        <p className={`text-xs mt-1 ${preset === "hackernews" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Classic orange accents on stark backgrounds</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("winxp")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "winxp" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Windows XP</p>
                                                        <p className={`text-xs mt-1 ${preset === "winxp" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>The legendary Luna aesthetic with blue gradients</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("gameboy")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "gameboy" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">GameBoy</p>
                                                        <p className={`text-xs mt-1 ${preset === "gameboy" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Retro 4-shade green dot matrix aesthetic</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("nord")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "nord" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Nord</p>
                                                        <p className={`text-xs mt-1 ${preset === "nord" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Arctic blue and slate grey for calm focus</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("terminal")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "terminal" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Terminal</p>
                                                        <p className={`text-xs mt-1 ${preset === "terminal" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Neon green matrix aesthetic with scanlines</p>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePresetChange("nature")}
                                                        className={`gum-btn text-left px-4 py-3 transition-all ${preset === "nature" ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                    >
                                                        <p className="font-bold text-sm">Nature</p>
                                                        <p className={`text-xs mt-1 ${preset === "nature" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Soft nature modernism with forest vibes</p>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                            <div>
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Layout size={18} className="text-primary" /> Theme Mode</h2>
                                                <p className="text-sm text-muted-foreground mb-4">Choose how you experience the illusion.</p>
                                                <div className="flex flex-wrap gap-3">
                                                    {(["light", "dark", "system"] as const).map((m) => (
                                                        <button 
                                                            key={m}
                                                            onClick={() => setTheme(m)}
                                                            className={`gum-btn px-6 py-2.5 text-sm font-bold flex items-center gap-2 capitalize transition-all ${theme === m ? 'bg-primary text-primary-foreground gum-shadow-sm scale-105' : 'bg-background hover:bg-secondary border-border/50 text-foreground'}`}
                                                        >
                                                            {m === "light" && <Sun size={16}/>}
                                                            {m === "dark" && <Moon size={16}/>}
                                                            {m === "system" && <Monitor size={16}/>}
                                                            {m}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Pipette size={18} className="text-primary" /> Aura Color</h2>
                                                        <p className="text-sm text-muted-foreground">Select the primary resonance of your spells.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setAnimateColor(!animateColor)}
                                                        className={`gum-btn px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all ${animateColor ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        <span className={`inline-block ${animateColor ? 'animate-spin-slow' : ''}`}>🌈</span>
                                                        {animateColor ? 'Animated' : 'Animate'}
                                                    </button>
                                                </div>
                                                <div className={`flex flex-wrap gap-3 transition-opacity ${animateColor ? 'opacity-40 pointer-events-none' : ''}`}>
                                                    {(['purple', 'blue', 'green', 'orange', 'rose', 'zinc'] as const).map((c) => (
                                                        <button 
                                                            key={c}
                                                            onClick={() => setColor(c)}
                                                            className={`w-12 h-12 rounded-full border-4 transition-all flex items-center justify-center ${color === c ? 'border-primary/50 shadow-lg scale-110 shadow-primary/20' : 'border-transparent hover:scale-105'}`}
                                                            style={{
                                                                backgroundColor: `hsl(${
                                                                    c === 'purple' ? '270 30% 63%' :
                                                                    c === 'blue' ? '220 70% 50%' :
                                                                    c === 'green' ? '142 60% 45%' :
                                                                    c === 'orange' ? '24 85% 55%' :
                                                                    c === 'rose' ? '346 80% 60%' :
                                                                    '240 5% 50%'
                                                                })`
                                                            }}
                                                        >
                                                            {color === c && <Check size={20} className="text-primary-foreground" />}
                                                        </button>
                                                    ))}
                                                    {/* Custom color picker */}
                                                    <label
                                                        className={`w-12 h-12 rounded-full border-4 transition-all flex items-center justify-center cursor-pointer overflow-hidden relative group ${color === 'custom' ? 'border-primary/50 shadow-lg scale-110 shadow-primary/20' : 'border-border/30 hover:border-border/60 bg-muted hover:bg-secondary border-dashed'}`}
                                                        style={color === 'custom' ? { backgroundColor: customColor } : undefined}
                                                        title="Pick custom color"
                                                    >
                                                        {color === 'custom' ? (
                                                            <Check size={20} className="text-white drop-shadow" />
                                                        ) : (
                                                            <Palette size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                                                        )}
                                                        <input
                                                            type="color"
                                                            value={customColor}
                                                            onChange={(e) => {
                                                                setCustomColor(e.target.value);
                                                                setColor('custom');
                                                            }}
                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                            aria-label="Custom primary color"
                                                        />
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Type size={18} className="text-primary" /> Typography</h2>
                                                <p className="text-sm text-muted-foreground mb-4">Set the textual vibe of the illusion.</p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {(['Reddit Mono', 'Inter', 'Space Grotesk', 'Fira Code', 'JetBrains Mono', 'Comic Neue'] as const).map((f) => (
                                                        <button 
                                                            key={f}
                                                            onClick={() => setFont(f)}
                                                            className={`gum-btn px-4 py-3 text-sm font-bold truncate transition-colors ${font === f ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                            style={{
                                                                fontFamily:
                                                                    f === 'Reddit Mono' ? "'Reddit Mono', monospace" :
                                                                        f === 'Fira Code' || f === 'JetBrains Mono' ? `'${f}', monospace` :
                                                                            f === 'Comic Neue' ? "'Comic Neue', cursive" :
                                                                                `'${f}', sans-serif`,
                                                            }}
                                                        >
                                                            {f}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Smile size={18} className="text-primary" /> Emoji Pack</h2>
                                                <p className="text-sm text-muted-foreground mb-4">Choose how emojis are rendered across chats and posts.</p>
                                                <div className="mb-4 rounded-[3px] border border-border/60 bg-secondary/30 p-3">
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Current Preview</p>
                                                    <TwemojiText className="text-2xl leading-none">😀 😂 ❤️ 👍 🙏 😭 🔥</TwemojiText>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    <button
                                                        onClick={() => setEmojiPack("native")}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${emojiPack === "native" ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        Device Default
                                                    </button>
                                                    <button
                                                        onClick={() => setEmojiPack("twemoji")}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${emojiPack === "twemoji" ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        Twitter
                                                    </button>
                                                    <button
                                                        onClick={() => setEmojiPack("google")}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${emojiPack === "google" ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        Google
                                                    </button>
                                                    <button
                                                        onClick={() => setEmojiPack("openmoji")}
                                                        className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${emojiPack === "openmoji" ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        OpenMoji
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Square size={18} className="text-primary" /> Border Radius</h2>
                                                <p className="text-sm text-muted-foreground mb-4">How sharp should the edges be?</p>
                                                <div className="flex flex-wrap gap-3">
                                                    {(['none', 'default', 'md', 'lg', 'full'] as const).map((r) => (
                                                        <button 
                                                            key={r}
                                                            onClick={() => setRadius(r)}
                                                            className={`gum-btn px-6 py-2.5 text-sm font-bold capitalize transition-colors ${radius === r ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                            style={{ borderRadius: r === 'none' ? '0px' : r === 'default' ? '3px' : r === 'md' ? '8px' : r === 'lg' ? '16px' : '2rem' }}
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Grid size={18} className="text-primary" /> Background Grid</h2>
                                                <p className="text-sm text-muted-foreground mb-4">Choose the tactical matrix for your spells.</p>
                                                <div className="flex flex-wrap gap-3">
                                                    {(['blueprint', 'dotted', 'scanlines', 'none'] as const).map((g) => (
                                                        <button 
                                                            key={g}
                                                            onClick={() => setGrid(g)}
                                                            className={`gum-btn px-6 py-2.5 text-sm font-bold capitalize transition-colors ${grid === g ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                        >
                                                            {g}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border hidden md:block">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                                                            <WandSparkles size={18} className="text-primary" />
                                                            Cursor Trail
                                                        </h2>
                                                        <p className="text-sm text-muted-foreground">Follows your mouse with a glowing trail matching your Aura color.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setCursorTrail(!cursorTrail)}
                                                        className={`gum-btn px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all ${cursorTrail ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        {cursorTrail ? 'Enabled' : 'Disabled'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                                                            {shadowWalk ? <EyeOff size={18} className="text-primary" /> : <Eye size={18} className="text-muted-foreground" />}
                                                            Shadow Walk
                                                        </h2>
                                                        <p className="text-sm text-muted-foreground">Dims the UI, blurs avatars and usernames for public browsing. <kbd className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono border border-border">Ctrl+Shift+S</kbd></p>
                                                    </div>
                                                    <button
                                                        onClick={() => setShadowWalk(!shadowWalk)}
                                                        className={`gum-btn px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all ${shadowWalk ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        {shadowWalk ? '🥷 Active' : 'Disabled'}
                                                    </button>
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "data" && (
                                    <motion.div
                                        key="data"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                                                    <ImageOff className={dataSaver ? "text-primary" : "text-muted-foreground"} />
                                                    Data Saving
                                                </h2>
                                                <p className="text-sm text-muted-foreground">Control how media loads to reduce data usage.</p>
                                            </div>

                                            <div className="flex items-start justify-between gap-4 rounded-[3px] border border-border bg-secondary/30 p-4">
                                                <div className="pr-0 sm:pr-4">
                                                    <h3 className="font-bold mb-1">Manual Image Loading</h3>
                                                    <p className="text-sm text-muted-foreground">Blocks auto-loading for remote images. Tap each image to load it manually. Avatars and profile banners are always allowed.</p>
                                                </div>
                                                <button
                                                    onClick={() => setDataSaver(!dataSaver)}
                                                    className={`gum-btn px-4 py-2 text-sm font-bold shrink-0 transition-all ${dataSaver ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground border-2 border-border'}`}
                                                >
                                                    {dataSaver ? 'Enabled' : 'Disabled'}
                                                </button>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "audio" && (
                                    <motion.div
                                        key="audio"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                                    <Music className="text-primary" />
                                                    Audio & SFX
                                                </h2>
                                                
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex items-start justify-between bg-secondary/30 p-4 rounded-[3px] border border-border">
                                                        <div className="pr-4">
                                                            <h3 className="font-bold mb-1 flex items-center gap-2">
                                                                {soundEnabled ? <Volume2 size={18} className="text-primary" /> : <VolumeX size={18} className="text-muted-foreground" />}
                                                                {soundEnabled ? "Audio Engine Enabled" : "Audio Engine Muted"}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground">Synthesize responsive sound effects directly from your browser. Adds satisfying haptic clicks, hover feedback, and delicate typing notes without loading external assets.</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setSoundEnabled(!soundEnabled)}
                                                            className={`gum-btn shrink-0 w-20 h-10 text-sm font-bold transition-all ${soundEnabled ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground border-2 border-border'}`}
                                                        >
                                                            {soundEnabled ? "ON" : "OFF"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "security" && (
                                    <motion.div
                                        key="security"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                                    <KeyRound className="text-primary" />
                                                    Security
                                                </h2>

                                                {/* Authenticator App (2FA) */}
                                                <div className="bg-secondary/30 p-4 rounded-[3px] border border-border space-y-4">
                                                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                                        <div className="pr-0 sm:pr-4">
                                                            <h3 className="font-bold mb-1 flex items-center gap-2">
                                                                <Shield size={18} className={mfaFactorId ? "text-primary" : "text-muted-foreground"} />
                                                                Authenticator App (2FA)
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground">
                                                                Add an authenticator app for 6-digit verification codes at sign in.
                                                            </p>
                                                            <p className="text-xs mt-2 font-medium">
                                                                {mfaStatusLoading
                                                                    ? "Checking status..."
                                                                    : mfaStatusError
                                                                        ? "Status unavailable. Please retry."
                                                                    : !mfaStatusReady
                                                                        ? "Checking status..."
                                                                    : mfaFactorId
                                                                        ? `Status: Enabled (${mfaAalLevel === "aal2" ? "verified this session" : "needs verification on next sign in"})`
                                                                        : "Status: Disabled"}
                                                            </p>
                                                        </div>

                                                        {!mfaFactorId ? (
                                                            <button
                                                                onClick={handleStartMfaSetup}
                                                                disabled={mfaStatusLoading || !mfaStatusReady || mfaActionLoading || !!mfaSetup}
                                                                className="gum-btn shrink-0 w-28 h-10 text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50"
                                                            >
                                                                {mfaActionLoading ? <FrogLoader className="" size={16} /> : "Enable"}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={handleDisableMfa}
                                                                disabled={mfaStatusLoading || !mfaStatusReady || mfaActionLoading || mfaAalLevel !== "aal2"}
                                                                className="gum-btn shrink-0 w-28 h-10 text-sm font-bold bg-background hover:bg-secondary disabled:opacity-50"
                                                                title={mfaAalLevel !== "aal2" ? "Verify with 2FA first" : "Disable authenticator app"}
                                                            >
                                                                {mfaActionLoading ? <FrogLoader className="" size={16} /> : "Disable"}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {mfaStatusError && (
                                                        <div className="flex items-center justify-between gap-3 rounded-[3px] border border-destructive/30 bg-destructive/10 px-3 py-2">
                                                            <p className="text-xs font-medium text-destructive">{mfaStatusError}</p>
                                                            <button
                                                                onClick={() => void loadMfaStatus()}
                                                                className="gum-btn bg-background px-3 py-1.5 text-xs font-bold"
                                                                disabled={mfaStatusLoading || mfaActionLoading}
                                                            >
                                                                Retry
                                                            </button>
                                                        </div>
                                                    )}

                                                    {mfaSetup && (
                                                        <div className="p-4 bg-background border border-border rounded-[3px] space-y-4">
                                                            <p className="text-sm font-bold">Step 1: Scan QR code in your authenticator app</p>
                                                            <div className="flex flex-col sm:flex-row items-start gap-4">
                                                                <img
                                                                    src={buildQrImageSrc(mfaSetup.qrCode)}
                                                                    alt="Authenticator QR code"
                                                                    className="w-40 h-40 bg-white p-2 rounded-[3px] border border-border"
                                                                />
                                                                <div className="space-y-2">
                                                                    <p className="text-xs text-muted-foreground">If you cannot scan, enter this key manually:</p>
                                                                    <p className="text-xs font-mono bg-secondary px-2 py-1 rounded-[3px] break-all">
                                                                        {mfaSetup.secret}
                                                                    </p>
                                                                    <p className="text-[11px] text-muted-foreground break-all">
                                                                        URI: {mfaSetup.uri}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <p className="text-sm font-bold">Step 2: Enter the 6-digit code</p>
                                                                <div className="flex justify-center">
                                                                    <InputOTP
                                                                        maxLength={6}
                                                                        value={mfaCode}
                                                                        onChange={setMfaCode}
                                                                    >
                                                                        <InputOTPGroup>
                                                                            <InputOTPSlot index={0} className="w-10 h-10 text-base font-bold" />
                                                                            <InputOTPSlot index={1} className="w-10 h-10 text-base font-bold" />
                                                                            <InputOTPSlot index={2} className="w-10 h-10 text-base font-bold" />
                                                                            <InputOTPSlot index={3} className="w-10 h-10 text-base font-bold" />
                                                                            <InputOTPSlot index={4} className="w-10 h-10 text-base font-bold" />
                                                                            <InputOTPSlot index={5} className="w-10 h-10 text-base font-bold" />
                                                                        </InputOTPGroup>
                                                                    </InputOTP>
                                                                </div>

                                                                <div className="flex flex-wrap gap-2 justify-end">
                                                                    <button
                                                                        onClick={handleCancelMfaSetup}
                                                                        disabled={mfaActionLoading}
                                                                        className="gum-btn text-sm px-4 py-2 bg-secondary hover:bg-secondary/80 font-bold disabled:opacity-50"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={handleVerifyMfaSetup}
                                                                        disabled={mfaActionLoading || mfaCode.length !== 6}
                                                                        className="gum-btn text-sm px-4 py-2 bg-primary text-primary-foreground font-bold disabled:opacity-50"
                                                                    >
                                                                        {mfaActionLoading ? <FrogLoader className="" size={16} /> : "Verify & Enable"}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* App Lock Toggle */}
                                                <div className="flex items-start justify-between bg-secondary/30 p-4 rounded-[3px] border border-border">
                                                    <div className="pr-4">
                                                        <h3 className="font-bold mb-1 flex items-center gap-2">
                                                            <Lock size={18} className={appLockEnabled ? "text-primary" : "text-muted-foreground"} />
                                                            App Lock
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground">
                                                            Require a 4-digit PIN to open Genjutsu. Protects your session from casual access.
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (appLockEnabled) {
                                                                setPinStep("verify-current");
                                                                setPinValue("");
                                                                setPinError(null);
                                                            } else {
                                                                setPinStep("set-new");
                                                                setPinValue("");
                                                                setPinConfirm("");
                                                                setPinError(null);
                                                            }
                                                        }}
                                                        className={`gum-btn shrink-0 w-20 h-10 text-sm font-bold transition-all ${appLockEnabled ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground border-2 border-border'}`}
                                                    >
                                                        {appLockEnabled ? "ON" : "OFF"}
                                                    </button>
                                                </div>

                                                {/* PIN Setup / Verification Flows */}
                                                <AnimatePresence mode="wait">
                                                    {pinStep === "set-new" && (
                                                        <motion.div
                                                            key="set-new"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-4 p-4 bg-secondary/30 border border-border rounded-[3px] space-y-4"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold mb-3">Enter a 4-digit PIN</p>
                                                                <div className="flex justify-center">
                                                                    <InputOTP
                                                                        maxLength={4}
                                                                        value={pinValue}
                                                                        onChange={(v) => { setPinValue(v); setPinError(null); }}
                                                                        autoFocus
                                                                    >
                                                                        <InputOTPGroup>
                                                                            <InputOTPSlot index={0} className="w-12 h-12 text-lg font-bold" />
                                                                            <InputOTPSlot index={1} className="w-12 h-12 text-lg font-bold" />
                                                                            <InputOTPSlot index={2} className="w-12 h-12 text-lg font-bold" />
                                                                            <InputOTPSlot index={3} className="w-12 h-12 text-lg font-bold" />
                                                                        </InputOTPGroup>
                                                                    </InputOTP>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={() => { setPinStep("idle"); setPinValue(""); setPinError(null); }}
                                                                    className="gum-btn text-sm px-4 py-2 bg-secondary hover:bg-secondary/80 font-bold"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    disabled={pinValue.length !== 4}
                                                                    onClick={() => { setPinStep("confirm-new"); setPinConfirm(""); }}
                                                                    className="gum-btn text-sm px-4 py-2 bg-primary text-primary-foreground font-bold disabled:opacity-40"
                                                                >
                                                                    Next
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {pinStep === "confirm-new" && (
                                                        <motion.div
                                                            key="confirm-new"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-4 p-4 bg-secondary/30 border border-border rounded-[3px] space-y-4"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold mb-3">Confirm your PIN</p>
                                                                <div className="flex justify-center">
                                                                    <InputOTP
                                                                        maxLength={4}
                                                                        value={pinConfirm}
                                                                        onChange={(v) => {
                                                                            setPinConfirm(v);
                                                                            setPinError(null);
                                                                            if (v.length === 4) {
                                                                                if (v !== pinValue) {
                                                                                    setPinError("PINs don't match. Try again.");
                                                                                    setTimeout(() => setPinConfirm(""), 500);
                                                                                } else {
                                                                                    setPinStep("security-questions");
                                                                                }
                                                                            }
                                                                        }}
                                                                        autoFocus
                                                                    >
                                                                        <InputOTPGroup>
                                                                            <InputOTPSlot index={0} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={1} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={2} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={3} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                        </InputOTPGroup>
                                                                    </InputOTP>
                                                                </div>
                                                                {pinError && <p className="text-xs text-destructive text-center font-medium mt-2">{pinError}</p>}
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={() => { setPinStep("set-new"); setPinConfirm(""); setPinError(null); }}
                                                                    className="gum-btn text-sm px-4 py-2 bg-secondary hover:bg-secondary/80 font-bold"
                                                                >
                                                                    Back
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {pinStep === "security-questions" && (
                                                        <motion.div
                                                            key="security-questions"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-4 p-4 bg-secondary/30 border border-border rounded-[3px] space-y-4"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold mb-3">Set Security Questions</p>
                                                                <p className="text-xs text-muted-foreground mb-4">Choose two questions to recover your PIN if you forget it.</p>
                                                                
                                                                <div className="space-y-4">
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Question 1</label>
                                                                        <select 
                                                                            value={q1} 
                                                                            onChange={(e) => setQ1(e.target.value)}
                                                                            className="w-full bg-background border-2 border-border p-2 text-sm rounded-[3px] focus:outline-none focus:border-primary font-medium"
                                                                        >
                                                                            {PREDEFINED_QUESTIONS.map((q) => (
                                                                                <option key={q} value={q} disabled={q === q2}>{q}</option>
                                                                            ))}
                                                                        </select>
                                                                        <input 
                                                                            type="text" 
                                                                            value={a1} 
                                                                            onChange={(e) => setA1(e.target.value)} 
                                                                            placeholder="Your answer..."
                                                                            className="w-full bg-background border-2 border-border p-2 text-sm rounded-[3px] focus:outline-none focus:border-primary placeholder:text-muted-foreground/50 transition-colors"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Question 2</label>
                                                                        <select 
                                                                            value={q2} 
                                                                            onChange={(e) => setQ2(e.target.value)}
                                                                            className="w-full bg-background border-2 border-border p-2 text-sm rounded-[3px] focus:outline-none focus:border-primary font-medium"
                                                                        >
                                                                            {PREDEFINED_QUESTIONS.map((q) => (
                                                                                <option key={q} value={q} disabled={q === q1}>{q}</option>
                                                                            ))}
                                                                        </select>
                                                                        <input 
                                                                            type="text" 
                                                                            value={a2} 
                                                                            onChange={(e) => setA2(e.target.value)} 
                                                                            placeholder="Your answer..."
                                                                            className="w-full bg-background border-2 border-border p-2 text-sm rounded-[3px] focus:outline-none focus:border-primary placeholder:text-muted-foreground/50 transition-colors"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={() => { setPinStep("confirm-new"); setPinConfirm(""); setPinError(null); }}
                                                                    className="gum-btn text-sm px-4 py-2 bg-secondary hover:bg-secondary/80 font-bold"
                                                                    disabled={pinSaving}
                                                                >
                                                                    Back
                                                                </button>
                                                                <button
                                                                    disabled={!a1.trim() || !a2.trim() || q1 === q2 || pinSaving}
                                                                    onClick={() => {
                                                                        setPinSaving(true);
                                                                        Promise.all([
                                                                            hashPin(pinConfirm),
                                                                            hashPin(formatAnswer(a1)),
                                                                            hashPin(formatAnswer(a2))
                                                                        ]).then(([pinHash, a1Hash, a2Hash]) => {
                                                                            localStorage.setItem(APP_LOCK_HASH_KEY, pinHash);
                                                                            localStorage.setItem(APP_LOCK_Q1_KEY, q1);
                                                                            localStorage.setItem(APP_LOCK_Q2_KEY, q2);
                                                                            localStorage.setItem(APP_LOCK_A1_HASH_KEY, a1Hash);
                                                                            localStorage.setItem(APP_LOCK_A2_HASH_KEY, a2Hash);
                                                                            sessionStorage.setItem(APP_LOCK_SESSION_KEY, "true");
                                                                            setAppLockEnabled(true);
                                                                            setPinStep("idle");
                                                                            setPinValue("");
                                                                            setPinConfirm("");
                                                                            setA1("");
                                                                            setA2("");
                                                                            setPinSaving(false);
                                                                            toast.success("App Lock enabled with recovery questions!");
                                                                        });
                                                                    }}
                                                                    className="gum-btn text-sm px-4 py-2 bg-primary text-primary-foreground font-bold disabled:opacity-40"
                                                                >
                                                                    {pinSaving ? "Saving..." : "Save Lock"}
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {pinStep === "verify-current" && (
                                                        <motion.div
                                                            key="verify-current"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-4 p-4 bg-secondary/30 border border-border rounded-[3px] space-y-4"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold mb-3">Enter your current PIN to disable App Lock</p>
                                                                <div className="flex justify-center">
                                                                    <InputOTP
                                                                        maxLength={4}
                                                                        value={pinValue}
                                                                        onChange={(v) => {
                                                                            setPinValue(v);
                                                                            setPinError(null);
                                                                            if (v.length === 4) {
                                                                                const hash = localStorage.getItem(APP_LOCK_HASH_KEY);
                                                                                if (!hash) return;
                                                                                verifyPin(v, hash).then((ok) => {
                                                                                    if (ok) {
                                                                                        localStorage.removeItem(APP_LOCK_HASH_KEY);
                                                                                        localStorage.removeItem(APP_LOCK_Q1_KEY);
                                                                                        localStorage.removeItem(APP_LOCK_Q2_KEY);
                                                                                        localStorage.removeItem(APP_LOCK_A1_HASH_KEY);
                                                                                        localStorage.removeItem(APP_LOCK_A2_HASH_KEY);
                                                                                        sessionStorage.removeItem(APP_LOCK_SESSION_KEY);
                                                                                        setAppLockEnabled(false);
                                                                                        setPinStep("idle");
                                                                                        setPinValue("");
                                                                                        toast.success("App Lock disabled.");
                                                                                    } else {
                                                                                        setPinError("Wrong PIN.");
                                                                                        setTimeout(() => setPinValue(""), 500);
                                                                                    }
                                                                                });
                                                                            }
                                                                        }}
                                                                        autoFocus
                                                                    >
                                                                        <InputOTPGroup>
                                                                            <InputOTPSlot index={0} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={1} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={2} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={3} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                        </InputOTPGroup>
                                                                    </InputOTP>
                                                                </div>
                                                                {pinError && <p className="text-xs text-destructive text-center font-medium mt-2">{pinError}</p>}
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={() => { setPinStep("idle"); setPinValue(""); setPinError(null); }}
                                                                    className="gum-btn text-sm px-4 py-2 bg-secondary hover:bg-secondary/80 font-bold"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {pinStep === "change-new" && (
                                                        <motion.div
                                                            key="change-new"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-4 p-4 bg-secondary/30 border border-border rounded-[3px] space-y-4"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold mb-3">Enter your current PIN first</p>
                                                                <div className="flex justify-center">
                                                                    <InputOTP
                                                                        maxLength={4}
                                                                        value={pinValue}
                                                                        onChange={(v) => {
                                                                            setPinValue(v);
                                                                            setPinError(null);
                                                                            if (v.length === 4) {
                                                                                const hash = localStorage.getItem(APP_LOCK_HASH_KEY);
                                                                                if (!hash) return;
                                                                                verifyPin(v, hash).then((ok) => {
                                                                                    if (ok) {
                                                                                        setPinStep("change-confirm");
                                                                                        setPinValue("");
                                                                                        setPinConfirm("");
                                                                                        setPinError(null);
                                                                                    } else {
                                                                                        setPinError("Wrong PIN.");
                                                                                        setTimeout(() => setPinValue(""), 500);
                                                                                    }
                                                                                });
                                                                            }
                                                                        }}
                                                                        autoFocus
                                                                    >
                                                                        <InputOTPGroup>
                                                                            <InputOTPSlot index={0} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={1} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={2} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={3} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                        </InputOTPGroup>
                                                                    </InputOTP>
                                                                </div>
                                                                {pinError && <p className="text-xs text-destructive text-center font-medium mt-2">{pinError}</p>}
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={() => { setPinStep("idle"); setPinValue(""); setPinError(null); }}
                                                                    className="gum-btn text-sm px-4 py-2 bg-secondary hover:bg-secondary/80 font-bold"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {pinStep === "change-confirm" && (
                                                        <motion.div
                                                            key="change-confirm"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-4 p-4 bg-secondary/30 border border-border rounded-[3px] space-y-4"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold mb-3">
                                                                    {pinValue.length < 4 ? "Enter your new PIN" : "Confirm your new PIN"}
                                                                </p>
                                                                <div className="flex justify-center">
                                                                    <InputOTP
                                                                        maxLength={4}
                                                                        value={pinValue.length < 4 ? pinValue : pinConfirm}
                                                                        onChange={(v) => {
                                                                            setPinError(null);
                                                                            if (pinValue.length < 4) {
                                                                                setPinValue(v);
                                                                            } else {
                                                                                setPinConfirm(v);
                                                                                if (v.length === 4) {
                                                                                    if (v !== pinValue) {
                                                                                        setPinError("PINs don't match. Try again.");
                                                                                        setTimeout(() => { setPinConfirm(""); setPinValue(""); }, 500);
                                                                                    } else {
                                                                                        setPinSaving(true);
                                                                                        hashPin(v).then((hash) => {
                                                                                            localStorage.setItem(APP_LOCK_HASH_KEY, hash);
                                                                                            setPinStep("idle");
                                                                                            setPinValue("");
                                                                                            setPinConfirm("");
                                                                                            setPinSaving(false);
                                                                                            toast.success("PIN changed successfully!");
                                                                                        });
                                                                                    }
                                                                                }
                                                                            }
                                                                        }}
                                                                        autoFocus
                                                                    >
                                                                        <InputOTPGroup>
                                                                            <InputOTPSlot index={0} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={1} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={2} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                            <InputOTPSlot index={3} className={`w-12 h-12 text-lg font-bold ${pinError ? 'border-destructive' : ''}`} />
                                                                        </InputOTPGroup>
                                                                    </InputOTP>
                                                                </div>
                                                                {pinError && <p className="text-xs text-destructive text-center font-medium mt-2">{pinError}</p>}
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={() => { setPinStep("idle"); setPinValue(""); setPinConfirm(""); setPinError(null); }}
                                                                    className="gum-btn text-sm px-4 py-2 bg-secondary hover:bg-secondary/80 font-bold"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {/* Change PIN button (only when lock is enabled and no flow active) */}
                                                {appLockEnabled && pinStep === "idle" && (
                                                    <div className="mt-4 pt-4 border-t border-border">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="font-bold mb-1 text-sm">Change PIN</h3>
                                                                <p className="text-xs text-muted-foreground">Update your app lock PIN to a new one.</p>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setPinStep("change-new");
                                                                    setPinValue("");
                                                                    setPinConfirm("");
                                                                    setPinError(null);
                                                                }}
                                                                className="gum-btn text-sm px-4 py-2 bg-secondary hover:bg-secondary/80 font-bold"
                                                            >
                                                                Change
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Info note */}
                                                <p className="text-[11px] text-muted-foreground mt-4">
                                                    This is a convenience lock stored in your browser. Clearing browser data will reset it.
                                                </p>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "notifications" && (
                                    <motion.div
                                        key="notifications"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                                    <Bell className="text-primary" />
                                                    Push Notifications
                                                </h2>
                                                
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex flex-col sm:flex-row items-start justify-between bg-secondary/30 p-4 sm:p-5 rounded-[3px] border border-border gap-4 sm:gap-0">
                                                        <div className="pr-0 sm:pr-6">
                                                            <h3 className="font-bold mb-2 flex items-center gap-2">
                                                                {pushNotifications.isSubscribed ? <Bell size={18} className="text-primary" /> : <BellOff size={18} className="text-muted-foreground" />}
                                                                {pushNotifications.isSubscribed ? "Notifications Enabled" : "Notifications Disabled"}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                                                Get instantly notified when you receive a new whisper, or when someone engages with your posts. Alerts arrive natively via your OS, even when Genjutsu is closed.
                                                            </p>
                                                            
                                                            <div className="space-y-2 mb-4 hidden sm:block">
                                                                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                                    <p><strong>Whisper Previews:</strong> See who sent it and a short secure preview.</p>
                                                                </div>
                                                                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                                    <p><strong>Smart Suppression:</strong> Notifications are hidden if you are actively looking at the app.</p>
                                                                </div>
                                                                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                                    <p><strong>Per-Device Security:</strong> Subscription is tied to this specific browser. You must enable it on every device you use.</p>
                                                                </div>
                                                            </div>

                                                            {!pushNotifications.isSupported ? (
                                                                <p className="text-sm text-destructive font-bold p-3 bg-destructive/10 border border-destructive/20 rounded-[3px] max-w-[500px]">
                                                                    ⚠️ Push notifications are not supported in this browser setup. If you are on iOS, you must add this site to your Home Screen first!
                                                                </p>
                                                            ) : pushNotifications.permission === "denied" ? (
                                                                <p className="text-sm text-destructive font-bold p-3 bg-destructive/10 border border-destructive/20 rounded-[3px] max-w-[500px]">
                                                                    ⚠️ Notifications are blocked. Please allow them in your browser/device settings to proceed.
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                        
                                                        {pushNotifications.isSupported && pushNotifications.permission !== "denied" && (
                                                            <button
                                                                onClick={async () => {
                                                                    const { error } = await pushNotifications.toggle();
                                                                    if (error) {
                                                                        toast.error(error);
                                                                    } else {
                                                                        toast.success(pushNotifications.isSubscribed ? "Push notifications disabled" : "Push notifications enabled!");
                                                                    }
                                                                }}
                                                                disabled={pushNotifications.loading}
                                                                className={`gum-btn shrink-0 w-full sm:w-28 h-10 flex items-center justify-center text-sm font-bold transition-all ${
                                                                    pushNotifications.isSubscribed 
                                                                        ? 'bg-background hover:bg-secondary text-foreground border-2 border-border' 
                                                                        : 'bg-primary text-primary-foreground gum-shadow-sm'
                                                                }`}
                                                            >
                                                                {pushNotifications.loading ? (
                                                                    <FrogLoader size={16} />
                                                                ) : pushNotifications.isSubscribed ? "Disable" : "Enable"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "danger" && !dangerUnlockedSession && (
                                    <motion.div
                                        key="danger-locked"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 flex flex-col items-center justify-center text-center py-16">
                                            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                                                <Lock size={32} className="text-destructive mb-1" />
                                            </div>
                                            <h2 className="text-2xl font-bold mb-2 text-foreground uppercase tracking-tight">Zone Sealed</h2>
                                            <p className="text-sm text-muted-foreground mb-8 max-w-sm">
                                                You have recently accessed the danger zone. For your security, this terminal has been locked.
                                            </p>
                                            
                                            <div className="flex items-center gap-3 bg-secondary/50 border border-border px-6 py-4 rounded-[3px]">
                                                <Clock className="text-destructive animate-pulse" size={20} />
                                                <span className="font-mono text-2xl font-bold tracking-widest">{formatTime(dangerTimeLeft)}</span>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "danger" && dangerUnlockedSession && (
                                    <motion.div
                                        key="danger"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6">
                                            <h2 className="text-lg font-bold mb-2 text-destructive uppercase tracking-tight">{t("settings.dangerZone")}</h2>
                                            <p className="text-sm text-muted-foreground mb-6">
                                                {t("settings.dangerZoneDesc")}
                                            </p>

                                            <div className="space-y-4">
                                                <h3 className="text-base font-bold text-destructive mb-2 uppercase tracking-tight">{t("settings.deleteAccount")}</h3>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {t("settings.deleteAccountDesc")}
                                                </p>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <button
                                                            className="gum-btn bg-destructive hover:bg-destructive/90 text-white w-full sm:w-auto font-bold flex items-center justify-center gap-2"
                                                        >
                                                            <Shield size={18} className="animate-pulse" />
                                                            {t("settings.exterminateAccount")}
                                                        </button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="gum-card border-destructive/50">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-destructive flex items-center gap-2">
                                                                <Shield size={20} />
                                                                {t("settings.areYouSure")}
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription asChild className="space-y-3">
                                                                <div>
                                                                    <p>
                                                                        {t("settings.deleteConfirmDesc")} <span className="font-mono font-bold text-foreground">@{profile?.username}</span>
                                                                    </p>
                                                                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-[3px]">
                                                                        <p className="text-xs font-bold text-destructive uppercase tracking-widest mb-1">{t("settings.typeUsername")}</p>
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
                                                            <AlertDialogCancel className="rounded-[3px]">{t("settings.cancel")}</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                disabled={deleteConfirmation !== profile?.username || isDeleting}
                                                                onClick={handleDeleteAccount}
                                                                className="bg-destructive text-white hover:bg-destructive/90 rounded-[3px] font-bold"
                                                            >
                                                                {isDeleting ? (
                                                                    <FrogLoader size={16} className=" mr-2" />
                                                                ) : null}
                                                                {t("settings.finalDestruction")}
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
