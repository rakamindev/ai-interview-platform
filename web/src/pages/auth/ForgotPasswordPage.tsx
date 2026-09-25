import { useState } from "react";
import { Link } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await authApi.forgotPassword(email);
      setMessage(response.data.message);
      setDevToken(response.data.dev_reset_token ?? null);
    } catch {
      setMessage("If an account exists for that email, password reset instructions have been prepared.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 space-y-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="h-5 w-5" /></div>
          <p className="text-sm font-medium text-primary">Account recovery</p>
          <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
          <p className="text-sm leading-6 text-muted-foreground">Enter your email. The response stays intentionally generic so registered accounts cannot be enumerated.</p>
        </div>

        {!message ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="email">Work email</Label><Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Prepare reset link</Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex gap-3"><MailCheck className="mt-0.5 h-5 w-5 text-primary" /><p className="text-sm leading-6">{message}</p></div>
            </div>
            {devToken && (
              <Link to={`/reset-password?token=${encodeURIComponent(devToken)}`} className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Continue with development reset token</Link>
            )}
            <p className="text-xs leading-5 text-muted-foreground">In production this token would be delivered by an email provider. It is returned only in development/test so the take-home flow can be verified end-to-end.</p>
          </div>
        )}

        <Link to="/login" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
