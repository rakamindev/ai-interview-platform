import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) return setError("This reset link is missing its token.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirmation) return setError("Password confirmation does not match.");

    setLoading(true);
    try {
      await authApi.resetPassword({ token, password, password_confirmation: confirmation });
      setDone(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.errors?.[0]?.message ?? "This reset link is invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 space-y-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <p className="text-sm font-medium text-primary">Secure recovery</p>
          <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
          <p className="text-sm leading-6 text-muted-foreground">Reset tokens are signed, purpose-bound, and expire after 30 minutes.</p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Password updated. Redirecting to sign in…</div></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div>
            <div className="space-y-2"><Label htmlFor="confirmation">Confirm password</Label><Input id="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} minLength={8} required /></div>
            {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</div>}
            <Button type="submit" className="h-11 w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update password</Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground"><Link to="/login" className="font-medium text-primary hover:underline">Return to sign in</Link></p>
      </div>
    </AuthShell>
  );
}
