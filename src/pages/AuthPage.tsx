import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Sparkles, ArrowLeft, Mail } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp, signInWithGoogle, signInWithGitHub } = useAuth();
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      if (isSignUp) {
        const parsed = signUpSchema.parse({ email, password, username, displayName });
        const { data, error } = await signUp(parsed.email, parsed.password, parsed.username, parsed.displayName);
        if (error) {
          if (error.message?.includes("already registered")) {
            setError("This email is already registered. Try signing in instead.");
          } else if (error.message === "this_username_is_taken" || error.message?.includes("profiles_username_key") || error.message?.includes("Database error saving new user")) {
            setError("This username is already taken. Please choose another one.");
          } else if (error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("too many requests")) {
            setError("Email signup limit reached. Please try again later or sign up with Google or GitHub.");
          } else {
            setError(error.message || "Sign up failed");
          }
        } else if (!data?.session) {
          // Email confirmation is enabled
          setSuccess("Genjutsu initiated! Check your email (and spam) to confirm the illusion. If it doesn't arrive, try continuing with Google or GitHub.");
        } else {
          // Logged in immediately (confirmation disabled)
          navigate("/");
        }
      } else {
        const parsed = signInSchema.parse({ email, password });
        const { error } = await signIn(parsed.email, parsed.password);
        if (error) {
          if (error.message?.includes("Invalid login")) {
            setError("Invalid email or password.");
          } else if (error.message?.includes("Email not confirmed")) {
            setError("Please confirm your email before signing in. Check your spam, or try signing in with Google or GitHub instead.");
          } else if (error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("too many requests")) {
            setError("Email limit reached. Please try again later or sign in with Google or GitHub.");
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
    <div className="min-h-screen bg-background relative flex items-center justify-center overflow-x-hidden">
      <Helmet>
        <title>Join genjutsu — Everything Vanishes</title>
        <meta name="description" content="Sign in or create an account to start sharing your code in the 24-hour social network." />
      </Helmet>

      {/* Floating Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full h-full max-w-[1400px] flex flex-col lg:flex-row relative z-10 p-4 sm:p-8 lg:p-12 gap-12 lg:gap-20">

        {/* Left Side: Brand Showcase (Visible only on PC) */}
        <div className="hidden lg:flex flex-1 flex-col justify-center gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-20 h-20 rounded-[3px] gum-border mb-8 overflow-hidden shadow-2xl transition-transform duration-500">
              <img src="/fav.webp" alt="genjutsu" width={80} height={80} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-7xl font-black tracking-tighter italic mb-6 leading-[0.9]">
              everything <br />
              <span className="text-primary italic">vanishes.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg leading-relaxed font-medium">
              the transient social network for developers.
              share your code, thoughts, and whispers—all gone in 24 hours.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-8">
            {[
              { label: "Ephemeral", desc: "Posts last 24h" },
              { label: "Privacy First", desc: "No digital footprint" },
              { label: "Developer Core", desc: "Code-centric sharing" },
              { label: "Whispers", desc: "End-to-end ephemeral DMs" }
            ].map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
                className="gum-card p-6 grayscale hover:grayscale-0 transition-all duration-500 hover:scale-105"
              >
                <div className="text-primary font-black uppercase tracking-wider text-xs mb-1">{feature.label}</div>
                <div className="text-foreground text-sm font-bold">{feature.desc}</div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.3em]"
          >
            <div className="h-px w-10 bg-foreground" />
            building the future of transient dev-comms
          </motion.div>
        </div>

        {/* Right Side: Auth Form (Centered on mobile, aside on PC) */}
        <div className="flex-1 flex flex-col justify-center items-center lg:items-end">
          <div className="w-full max-w-md">
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate("/")}
              className="mb-8 inline-flex items-center gap-2 px-4 py-2 gum-card bg-secondary text-sm font-bold hover:bg-primary hover:text-primary-foreground transition-all duration-300 w-fit group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </motion.button>

            {/* Mobile Header (Visible only on mobile/tablet) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:hidden text-center mb-10"
            >
              <div className="w-16 h-16 rounded-[3px] gum-border mx-auto mb-6 overflow-hidden shadow-xl">
                <img src="/fav.webp" alt="genjutsu" width={64} height={64} className="w-full h-full object-cover" />
              </div>
              <h1 className="text-4xl font-black tracking-tighter mb-2 italic">genjutsu</h1>
              <p className="text-muted-foreground text-sm font-medium">Everything vanishes. Social media for developers.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="gum-card p-8 bg-background shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-primary/10"
            >
              <AnimatePresence mode="wait">
                {!showEmailForm ? (
                  /* ===== MAIN VIEW: OAuth + Email Entry Point ===== */
                  <motion.div
                    key="oauth-view"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-black mb-1">Welcome</h2>
                      <p className="text-sm text-muted-foreground">Choose how you'd like to continue</p>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-xs font-bold bg-destructive/10 text-destructive px-4 py-3 rounded-[3px] border-2 border-destructive/20"
                      >
                        {error}
                      </motion.div>
                    )}

                    <button
                      onClick={async () => {
                        setGoogleLoading(true);
                        setError("");
                        const { error } = await signInWithGoogle();
                        if (error) {
                          setError(error.message || "Google sign-in failed");
                          setGoogleLoading(false);
                        }
                      }}
                      disabled={googleLoading}
                      className="w-full gum-btn bg-background gum-border text-sm py-4 flex items-center justify-center gap-3 hover:bg-secondary hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {googleLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Sparkles className="animate-pulse" size={16} />
                          Redirecting...
                        </span>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                          </svg>
                          <span className="font-bold">Continue with Google</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={async () => {
                        setGithubLoading(true);
                        setError("");
                        const { error } = await signInWithGitHub();
                        if (error) {
                          setError(error.message || "GitHub sign-in failed");
                          setGithubLoading(false);
                        }
                      }}
                      disabled={githubLoading}
                      className="w-full gum-btn bg-background gum-border text-sm py-4 flex items-center justify-center gap-3 hover:bg-secondary hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {githubLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Sparkles className="animate-pulse" size={16} />
                          Redirecting...
                        </span>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                          </svg>
                          <span className="font-bold">Continue with GitHub</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-4 my-4">
                      <div className="flex-1 h-px bg-foreground/10" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">or</span>
                      <div className="flex-1 h-px bg-foreground/10" />
                    </div>

                    <button
                      onClick={() => { setShowEmailForm(true); setError(""); setSuccess(""); }}
                      className="w-full gum-btn bg-background gum-border text-sm py-4 flex items-center justify-center gap-3 hover:bg-secondary hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      <Mail size={20} />
                      <span className="font-bold">Continue with Email</span>
                    </button>
                  </motion.div>
                ) : (
                  /* ===== EMAIL FORM VIEW: Sign In / Sign Up ===== */
                  <motion.div
                    key="email-view"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      type="button"
                      onClick={() => { setShowEmailForm(false); setError(""); setSuccess(""); }}
                      className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors mb-6 group"
                    >
                      <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                      All sign in options
                    </button>

                    <div className="flex p-1 bg-secondary rounded-[3px] mb-8">
                      {["Sign In", "Sign Up"].map((tab, i) => (
                        <button
                          key={tab}
                          onClick={() => { setIsSignUp(i === 1); setError(""); setSuccess(""); }}
                          className={`flex-1 py-3 text-sm font-bold rounded-[3px] transition-all duration-300 ${(i === 0 && !isSignUp) || (i === 1 && isSignUp)
                            ? "bg-background text-foreground shadow-md scale-[1.02]"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      {isSignUp && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-5 overflow-hidden"
                        >
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 block">
                              Username
                            </label>
                            <input
                              id="username"
                              name="username"
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="cooldev42"
                              className="w-full px-4 py-3 bg-secondary/30 gum-border rounded-[3px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                              required
                              autoComplete="username"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 block">
                              Display Name
                            </label>
                            <input
                              id="display_name"
                              name="display_name"
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder="Cool Developer"
                              className="w-full px-4 py-3 bg-secondary/30 gum-border rounded-[3px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                              required
                            />
                          </div>
                        </motion.div>
                      )}

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 block">
                          Email
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@dev.com"
                          className="w-full px-4 py-3 bg-secondary/30 gum-border rounded-[3px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                          required
                          autoComplete="email"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 block">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-secondary/30 gum-border rounded-[3px] text-sm outline-none focus:ring-2 focus:ring-primary/20 pr-12 transition-all placeholder:text-muted-foreground/30"
                            required
                            autoComplete={isSignUp ? "new-password" : "current-password"}
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

                      {error && (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-xs font-bold bg-destructive/10 text-destructive px-4 py-3 rounded-[3px] border-2 border-destructive/20"
                        >
                          {error}
                        </motion.div>
                      )}

                      {success && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-xs font-bold bg-primary/10 text-foreground px-4 py-3 rounded-[3px] gum-border"
                        >
                          {success}
                        </motion.div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full gum-btn bg-primary text-primary-foreground text-sm py-4 font-bold shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
                      >
                        {submitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <FrogLoader size={16} />
                            Processing...
                          </span>
                        ) : isSignUp ? "Create Account" : "Sign In"}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
