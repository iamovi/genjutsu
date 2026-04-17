import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const MFA_ROUTE = "/auth/mfa";

export default function MfaSessionGuard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    const enforceMfa = async () => {
      const isMfaRoute = location.pathname === MFA_ROUTE;
      const redirectToMfa = () => {
        navigate(MFA_ROUTE, {
          replace: true,
          state: { from: `${location.pathname}${location.search}${location.hash}` },
        });
      };

      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;

      // Security-first fallback: if assurance cannot be checked, require MFA route.
      if (error || !data) {
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (cancelled) return;

        if (factorsError) {
          if (!isMfaRoute) {
            redirectToMfa();
          }
          return;
        }

        const hasVerifiedTotp = (factorsData?.totp?.length ?? 0) > 0;
        if (hasVerifiedTotp && !isMfaRoute) {
          redirectToMfa();
        }
        if (!hasVerifiedTotp && isMfaRoute) {
          navigate("/", { replace: true });
        }
        return;
      }

      const requiresChallenge = data.nextLevel === "aal2" && data.currentLevel !== "aal2";

      if (requiresChallenge && !isMfaRoute) {
        redirectToMfa();
        return;
      }

      if (!requiresChallenge && isMfaRoute) {
        navigate("/", { replace: true });
      }
    };

    void enforceMfa();

    return () => {
      cancelled = true;
    };
  }, [loading, user, location.pathname, location.search, location.hash, navigate]);

  return null;
}
