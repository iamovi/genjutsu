import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Sparkles, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Helmet } from "react-helmet-async";

const signUpSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, underscores"),
  displayName: z.string().trim().min(1, "Display name is required").max(100),
});

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      if (isSignUp) {
        const parsed = signUpSchema.parse({ email, password, username, displayName });
        const { error } = await signUp(parsed.email, parsed.password, parsed.username, parsed.displayName);
        if (error) {
          if (error.message?.includes("already registered")) {
            setError("This email is already registered. Try signing in instead.");
          } else {
            setError(error.message || "Sign up failed");
          }
        } else {
          setSuccess("Check your email to confirm your account, then sign in!");
        }
      } else {
        const parsed = signInSchema.parse({ email, password });
        const { error } = await signIn(parsed.email, parsed.password);
        if (error) {
          if (error.message?.includes("Invalid login")) {
            setError("Invalid email or password.");
          } else if (error.message?.includes("Email not confirmed")) {
            setError("Please confirm your email before signing in.");
          } else {
            setError(error.message || "Sign in failed");
          }
        } else {
          navigate("/");
        }
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 text-foreground">
      <Helmet>
        <title>Join genjutsu — Everything Vanishes</title>
        <meta name="description" content="Sign in or create an account to start sharing your code in the 24-hour social network." />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative"
      >
        <button
          onClick={() => navigate("/")}
          className="absolute -top-12 left-0 inline-flex items-center gap-2 px-3 py-1.5 gum-card bg-secondary text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-colors w-fit"
        >
          <ArrowLeft size={14} />
          Back to Home
        </button>

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-[3px] gum-border mx-auto mb-4 overflow-hidden">
            <img src="/fav.jpg" alt="genjutsu" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">genjutsu</h1>
          <p className="text-muted-foreground mt-1 text-sm">Everything vanishes. Social media for developers.</p>
        </div>

        <div className="gum-card p-6">
          <div className="flex mb-6">
            {["Sign In", "Sign Up"].map((tab, i) => (
              <button
                key={tab}
                onClick={() => { setIsSignUp(i === 1); setError(""); setSuccess(""); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${(i === 0 && !isSignUp) || (i === 1 && isSignUp)
                  ? "bg-primary text-primary-foreground gum-shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="cooldev42"
                    className="w-full px-4 py-2.5 bg-background gum-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Cool Developer"
                    className="w-full px-4 py-2.5 bg-background gum-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@dev.com"
                className="w-full px-4 py-2.5 bg-background gum-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-background gum-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm bg-destructive/10 text-destructive px-3 py-2 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            {success && (
              <div className="text-sm bg-primary/10 text-foreground px-3 py-2 rounded-lg gum-border">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full gum-btn bg-primary text-primary-foreground text-sm py-3 disabled:opacity-50"
            >
              {submitting ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
