import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { FrogLoader } from "@/components/ui/FrogLoader";

const passwordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters").max(72),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const UpdatePasswordPage = () => {
  const navigate = useNavigate();
  const { updatePassword, isRecoverySession, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    if (loading) return;

    // Only allow password updates if we strictly confirmed a recovery session.
    // This prevents logged-in users from inadvertently changing their current session's
    // password when opening an invalid or unrelated reset link.
    setHasRecoverySession(isRecoverySession);
    setCheckingSession(false);
  }, [loading, isRecoverySession]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const parsed = passwordSchema.parse({ password, confirmPassword });
      const { error } = await updatePassword(parsed.password);

      if (error) {
        const message = String(error.message || "").toLowerCase();
        if (message.includes("session") || message.includes("expired")) {
          setError("This reset link is expired or invalid. Request a new password reset email.");
        } else if (message.includes("rate limit") || message.includes("too many requests")) {
          setError("Password update limit reached. Please try again later.");
        } else {
          setError(error.message || "Could not update password.");
        }
        return;
      }

      toast.success("Password updated. You're signed in with your new password.");
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Helmet>
        <title>Update Password — genjutsu</title>
        <meta name="description" content="Set a new password for your genjutsu account." />
      </Helmet>

      <div className="w-full max-w-md gum-card p-8 space-y-6">
        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to sign in
        </button>

        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-[3px] gum-card bg-secondary flex items-center justify-center">
            <KeyRound size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Set New Password</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Create a fresh password for your account. Reset links can only be used once.
            </p>
          </div>
        </div>

        {checkingSession ? (
          <div className="flex justify-center py-8">
            <FrogLoader size={24} />
          </div>
        ) : !hasRecoverySession ? (
          <div className="space-y-4">
            <div className="text-sm font-bold bg-destructive/10 text-destructive px-4 py-3 rounded-[3px] border-2 border-destructive/20">
              This password reset link is expired or invalid. Please request a new reset email.
            </div>
            <button
              type="button"
              onClick={() => navigate("/auth?mode=reset")}
              className="w-full gum-btn bg-primary text-primary-foreground text-sm py-3 font-bold"
            >
              Request a New Link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 block">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-secondary/30 gum-border rounded-[3px] text-sm outline-none focus:ring-2 focus:ring-primary/20 pr-12 transition-all placeholder:text-muted-foreground/30"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 block">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-secondary/30 gum-border rounded-[3px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="text-xs font-bold bg-destructive/10 text-destructive px-4 py-3 rounded-[3px] border-2 border-destructive/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full gum-btn bg-primary text-primary-foreground text-sm py-4 font-bold shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <FrogLoader size={16} />
                  Updating...
                </span>
              ) : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default UpdatePasswordPage;
