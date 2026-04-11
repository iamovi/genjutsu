import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, AlertTriangle, KeyRound } from "lucide-react";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import {
    APP_LOCK_HASH_KEY,
    APP_LOCK_SESSION_KEY,
    APP_LOCK_Q1_KEY,
    APP_LOCK_Q2_KEY,
    APP_LOCK_A1_HASH_KEY,
    APP_LOCK_A2_HASH_KEY,
    verifyPin,
    hashPin,
    formatAnswer
} from "@/lib/pin";

interface AppLockGateProps {
    children: React.ReactNode;
}

export function AppLockGate({ children }: AppLockGateProps) {
    const [state, setState] = useState<"checking" | "locked" | "unlocked" | "recovering" | "reset-new" | "reset-confirm">("checking");
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);
    const [attempts, setAttempts] = useState(0);

    // Recovery states
    const [recA1, setRecA1] = useState("");
    const [recA2, setRecA2] = useState("");
    const [recError, setRecError] = useState(false);
    
    // Reset PIN states
    const [newPin, setNewPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");

    // On mount, determine if we need the lock screen
    useEffect(() => {
        const hash = localStorage.getItem(APP_LOCK_HASH_KEY);
        if (!hash) {
            setState("unlocked");
            return;
        }

        const sessionUnlocked = sessionStorage.getItem(APP_LOCK_SESSION_KEY);
        if (sessionUnlocked === "true") {
            setState("unlocked");
            return;
        }

        setState("locked");
    }, []);

    const handlePinComplete = useCallback(async (value: string) => {
        const hash = localStorage.getItem(APP_LOCK_HASH_KEY);
        if (!hash) return;

        const isCorrect = await verifyPin(value, hash);

        if (isCorrect) {
            sessionStorage.setItem(APP_LOCK_SESSION_KEY, "true");
            setState("unlocked");
            setError(false);
        } else {
            setError(true);
            setAttempts((prev) => prev + 1);
            setTimeout(() => {
                setPin("");
                setError(false);
            }, 600);
        }
    }, []);

    const handleRecoverySubmit = async () => {
        const hash1 = localStorage.getItem(APP_LOCK_A1_HASH_KEY);
        const hash2 = localStorage.getItem(APP_LOCK_A2_HASH_KEY);
        
        const verify1 = await hashPin(formatAnswer(recA1));
        const verify2 = await hashPin(formatAnswer(recA2));
        
        if (verify1 === hash1 && verify2 === hash2) {
            setState("reset-new");
            setRecError(false);
        } else {
            setRecError(true);
        }
    };

    // Don't render anything while checking
    if (state === "checking") return null;

    // Unlocked — render the app
    if (state === "unlocked") return <>{children}</>;

    // Background overlay for all lock/recovery states
    const overlay = (
        <div className="absolute inset-0 opacity-[0.03]"
            style={{
                backgroundImage: `linear-gradient(hsl(var(--primary) / 0.4) 1px, transparent 1px),
                                  linear-gradient(90deg, hsl(var(--primary) / 0.4) 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
            }}
        />
    );

    return (
        <AnimatePresence mode="wait">
            {state === "locked" && (
                <motion.div
                    key="gate-locked"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
                >
                    {overlay}
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-sm w-full mx-4"
                    >
                        <motion.div
                            animate={error ? { rotate: [0, -8, 8, -8, 8, 0] } : {}}
                            transition={{ duration: 0.4 }}
                            className="flex items-center justify-center mb-2"
                        >
                            <img src="/logo.webp" alt="Genjutsu Logo" width={64} height={64} className="w-16 h-16 object-contain drop-shadow-md" />
                        </motion.div>

                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">genjutsu is locked</h1>
                            <p className="text-sm text-muted-foreground">Enter your 4-digit PIN to continue</p>
                        </div>

                        <motion.div animate={error ? { x: [0, -12, 12, -12, 12, 0] } : {}} transition={{ duration: 0.4 }}>
                            <InputOTP maxLength={4} value={pin} onChange={(v) => { setPin(v); if (v.length === 4) handlePinComplete(v); }} autoFocus>
                                <InputOTPGroup>
                                    {[0, 1, 2, 3].map(i => (
                                        <InputOTPSlot key={i} index={i} className={`w-14 h-14 text-xl font-bold border-2 transition-colors ${error ? "border-destructive text-destructive" : "border-border"}`} />
                                    ))}
                                </InputOTPGroup>
                            </InputOTP>
                        </motion.div>

                        <AnimatePresence>
                            {error && (
                                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-destructive font-medium">Wrong PIN. Try again.</motion.p>
                            )}
                        </AnimatePresence>

                        {/* Always show "Forgot PIN" if questions exist, but emphasize after 3 attempts */}
                        {localStorage.getItem(APP_LOCK_Q1_KEY) && (
                            <button onClick={() => setState("recovering")} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium mt-4">
                                Forgot PIN?
                            </button>
                        )}

                        {attempts >= 5 && !localStorage.getItem(APP_LOCK_Q1_KEY) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 border border-border px-4 py-2 rounded-[3px]">
                                <AlertTriangle size={14} className="text-destructive shrink-0" />
                                <span>Clear your browser data to reset.</span>
                            </div>
                        )}
                        
                        <p className="text-[11px] text-muted-foreground/50 mt-4">genjutsu — everything vanishes.</p>
                    </motion.div>
                </motion.div>
            )}

            {state === "recovering" && (
                <motion.div
                    key="gate-recovering"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
                >
                    {overlay}
                    <div className="relative z-10 w-full max-w-sm mx-4 bg-secondary/30 p-8 rounded-[3px] border border-border gum-shadow-sm">
                        <h2 className="text-xl font-bold text-center mb-2 flex items-center justify-center gap-2">
                            <KeyRound className="text-primary" />
                            Recover Access
                        </h2>
                        <p className="text-sm text-muted-foreground text-center mb-8">Answer your security questions to reset your PIN.</p>
                        
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-foreground">
                                    {localStorage.getItem(APP_LOCK_Q1_KEY)}
                                </label>
                                <input 
                                    type="text" 
                                    value={recA1} 
                                    onChange={e => setRecA1(e.target.value)} 
                                    className="w-full bg-background border-2 border-border p-3 text-sm rounded-[3px] focus:outline-none focus:border-primary text-foreground transition-all"
                                    placeholder="Your answer"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-foreground">
                                    {localStorage.getItem(APP_LOCK_Q2_KEY)}
                                </label>
                                <input 
                                    type="text" 
                                    value={recA2} 
                                    onChange={e => setRecA2(e.target.value)} 
                                    className="w-full bg-background border-2 border-border p-3 text-sm rounded-[3px] focus:outline-none focus:border-primary text-foreground transition-all"
                                    placeholder="Your answer"
                                />
                            </div>
                        </div>
                        
                        {recError && <p className="text-sm text-destructive font-medium mt-4 text-center">Answers are incorrect.</p>}
                        
                        <div className="flex gap-4 mt-8">
                            <button onClick={() => { setState("locked"); setRecA1(""); setRecA2(""); setRecError(false); setPin(""); setError(false); }} className="gum-btn flex-1 py-3 bg-background hover:bg-secondary border-2 border-border font-bold">Cancel</button>
                            <button onClick={handleRecoverySubmit} disabled={!recA1.trim() || !recA2.trim()} className="gum-btn flex-1 py-3 bg-primary text-primary-foreground font-bold disabled:opacity-40">Verify</button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Reset PIN - Enter New */}
            {state === "reset-new" && (
                <motion.div
                    key="gate-reset-new"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
                >
                    {overlay}
                    <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm p-8">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold">Set New PIN</h2>
                            <p className="text-sm text-muted-foreground">Enter a 4-digit PIN</p>
                        </div>
                        <InputOTP maxLength={4} value={newPin} onChange={(v) => { setNewPin(v); if (v.length === 4) setState("reset-confirm"); }} autoFocus>
                            <InputOTPGroup>
                                {[0, 1, 2, 3].map(i => <InputOTPSlot key={i} index={i} className="w-14 h-14 text-xl font-bold border-2 border-border" />)}
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                </motion.div>
            )}

            {/* Reset PIN - Confirm */}
            {state === "reset-confirm" && (
                <motion.div
                    key="gate-reset-confirm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
                >
                    {overlay}
                    <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm p-8">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold">Confirm PIN</h2>
                            <p className="text-sm text-muted-foreground">Confirm your new 4-digit PIN</p>
                        </div>
                        <motion.div animate={error ? { x: [0, -12, 12, -12, 12, 0] } : {}} transition={{ duration: 0.4 }}>
                            <InputOTP maxLength={4} value={confirmPin} onChange={(v) => { 
                                setConfirmPin(v);
                                setError(false);
                                if (v.length === 4) {
                                    if (v !== newPin) {
                                        setError(true);
                                        setTimeout(() => { setConfirmPin(""); setError(false); }, 1000);
                                    } else {
                                        hashPin(v).then(hash => {
                                            localStorage.setItem(APP_LOCK_HASH_KEY, hash);
                                            sessionStorage.setItem(APP_LOCK_SESSION_KEY, "true");
                                            setState("unlocked");
                                        });
                                    }
                                }
                            }} autoFocus>
                                <InputOTPGroup>
                                    {[0, 1, 2, 3].map(i => <InputOTPSlot key={i} index={i} className={`w-14 h-14 text-xl font-bold border-2 transition-colors ${error ? "border-destructive text-destructive" : "border-border"}`} />)}
                                </InputOTPGroup>
                            </InputOTP>
                        </motion.div>
                        {error && <p className="text-sm text-destructive font-medium">PINs don't match. Try again.</p>}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
