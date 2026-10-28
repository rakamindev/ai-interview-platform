import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch {
      setError("Email atau password tidak valid. Periksa kembali lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-primary px-10 py-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full border-[48px] border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full border-[56px] border-white/10" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold tracking-wide">Rakamin AI Interview</span>
          </div>
          <div className="relative max-w-md space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Assessment workspace</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              Make every assessment clearer and more trustworthy.
            </h1>
            <p className="max-w-sm text-sm leading-6 text-white/80">
              Review candidate evidence, follow interview progress, and compare skills with role requirements in one workspace.
            </p>
            <ul className="space-y-3 pt-2 text-sm text-white/90">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Evidence-led skill comparisons</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Clear assessment status and recovery</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Human review remains central</li>
            </ul>
          </div>
          <p className="relative text-xs text-white/65">AI supports the review process; it does not make hiring decisions.</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold">Rakamin AI Interview</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Welcome back</p>
              <h2 className="text-2xl font-semibold tracking-tight">Sign in to your account</h2>
              <p className="text-sm leading-6 text-muted-foreground">Continue to your assessment workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-invalid={Boolean(error)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Password</Label>
                  <span className="text-xs text-muted-foreground">Use your registered account</span>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={Boolean(error)}
                />
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{error}</p>
                </div>
              )}

              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="border-t pt-5 text-xs leading-5 text-muted-foreground">
              By signing in, you can review assessments and supporting evidence available to your account.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}