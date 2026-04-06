import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from "@/contexts/AccountTypeContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { bolt } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader as Loader2 } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { user, initialized, loading, signIn } = useAuth();
  const { accountType, loading: atLoading } = useAccountType();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || null;

  // Redirect once auth resolves and user is present.
  useEffect(() => {
    if (initialized && !loading && !atLoading && user) {
      if (from) {
        navigate(from, { replace: true });
      } else if (!accountType || accountType === null) {
        navigate("/choose-account-type", { replace: true });
      } else if (accountType === "recruiter") {
        navigate("/recruiter/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [initialized, loading, atLoading, user, accountType, navigate, from]);

  if (!initialized || loading || atLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || googleLoading) return;
    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message || t.common.error);
      // onAuthStateChange updates user → useEffect above fires navigate
    } catch {
      toast.error(t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (submitting || googleLoading) return;
    setGoogleLoading(true);
    try {
      const result = await bolt.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) toast.error(result.error.message || t.common.error);
    } catch {
      toast.error(t.common.error);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <h1 className="mt-6 text-xl font-display font-bold text-foreground">{t.auth.login}</h1>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full mb-4"
          onClick={handleGoogleLogin}
          disabled={googleLoading || submitting}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {googleLoading ? t.common.loading : t.auth.continueWithGoogle}
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-body">{t.auth.orContinueWith}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-display font-medium text-foreground mb-1.5 block">{t.auth.email}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              autoComplete="email"
              className="bg-card"
            />
          </div>
          <div>
            <label className="text-sm font-display font-medium text-foreground mb-1.5 block">{t.auth.password}</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="bg-card"
            />
          </div>
          <div className="text-end">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline font-body">
              {t.auth.forgotPassword}
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={submitting || googleLoading}>
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                {t.common.loading}
              </>
            ) : (
              t.auth.login
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground font-body">
          {t.auth.noAccount}{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            {t.auth.signup}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
