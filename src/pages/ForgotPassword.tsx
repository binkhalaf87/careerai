import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <h1 className="mt-6 text-xl font-display font-bold text-foreground">{t.auth.resetPassword}</h1>
          <p className="mt-2 text-sm text-muted-foreground font-body">{t.auth.resetDescription}</p>
        </div>

        {sent ? (
          <div className="text-center p-6 bg-card rounded-xl border border-border">
            <p className="text-foreground font-body mb-4">Check your email for a reset link!</p>
            <Link to="/login" className="text-primary hover:underline font-medium text-sm">
              {t.auth.backToLogin}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-display font-medium text-foreground mb-1.5 block">
                {t.auth.email}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="bg-card"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.common.loading : t.auth.sendReset}
            </Button>
            <p className="text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">
                {t.auth.backToLogin}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
