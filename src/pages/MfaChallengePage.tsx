import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KeyRound, ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type LocationState = {
  from?: string;
};

const MfaChallengePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signOut } = useAuth();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [screenLoading, setScreenLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const loadFactor = useCallback(async () => {
    if (!user) return;

    setScreenLoading(true);
    setLoadError(null);
    setVerifyError(null);

    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      setFactorId(null);
      setLoadError("Could not load your 2FA settings. Please retry.");
      setScreenLoading(false);
      return;
    }

    const verifiedTotp = data?.totp?.[0] ?? null;
    if (!verifiedTotp) {
      navigate("/", { replace: true });
      return;
    }

    setFactorId(verifiedTotp.id);
    setScreenLoading(false);
  }, [user, navigate]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    void loadFactor();
  }, [loading, user, navigate, loadFactor]);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;
    setSubmitting(true);
    setVerifyError(null);

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    setSubmitting(false);

    if (error) {
      setVerifyError("Invalid or expired code. Please try again.");
      return;
    }

    const state = location.state as LocationState | null;
    const destination = state?.from && state.from.startsWith("/") ? state.from : "/";
    toast.success("2FA verified.");
    navigate(destination, { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (loading || screenLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <FrogLoader size={24} className="" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Helmet>
        <title>Two-Factor Verification — genjutsu</title>
      </Helmet>

      <div className="w-full max-w-md gum-card p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-[3px] gum-card bg-secondary flex items-center justify-center">
            <KeyRound size={22} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">Two-Factor Verification</h1>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        {loadError ? (
          <div className="space-y-4">
            <p className="text-center text-sm text-destructive font-medium">{loadError}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => void loadFactor()}
                disabled={screenLoading}
                className="gum-btn bg-primary text-primary-foreground font-bold disabled:opacity-50"
                type="button"
              >
                Retry
              </button>
              <button
                onClick={handleSignOut}
                className="gum-btn bg-background text-foreground font-bold flex items-center justify-center gap-2"
                type="button"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setVerifyError(null);
                }}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className={`w-11 h-11 text-base font-bold ${verifyError ? "border-destructive" : ""}`} />
                  <InputOTPSlot index={1} className={`w-11 h-11 text-base font-bold ${verifyError ? "border-destructive" : ""}`} />
                  <InputOTPSlot index={2} className={`w-11 h-11 text-base font-bold ${verifyError ? "border-destructive" : ""}`} />
                  <InputOTPSlot index={3} className={`w-11 h-11 text-base font-bold ${verifyError ? "border-destructive" : ""}`} />
                  <InputOTPSlot index={4} className={`w-11 h-11 text-base font-bold ${verifyError ? "border-destructive" : ""}`} />
                  <InputOTPSlot index={5} className={`w-11 h-11 text-base font-bold ${verifyError ? "border-destructive" : ""}`} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {verifyError && (
              <p className="text-center text-sm text-destructive font-medium">{verifyError}</p>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleVerify}
                disabled={submitting || code.length !== 6 || !factorId}
                className="gum-btn bg-primary text-primary-foreground font-bold disabled:opacity-50"
              >
                {submitting ? <FrogLoader size={16} className="" /> : "Verify"}
              </button>

              <button
                onClick={() => navigate(-1)}
                className="gum-btn bg-secondary text-foreground font-bold flex items-center justify-center gap-2"
                type="button"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <button
                onClick={handleSignOut}
                className="gum-btn bg-background text-foreground font-bold flex items-center justify-center gap-2"
                type="button"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MfaChallengePage;
