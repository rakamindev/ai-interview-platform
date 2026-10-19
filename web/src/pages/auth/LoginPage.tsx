import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, LayoutDashboard, Loader2, Mail, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

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
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "h-11 rounded-lg border-border bg-white pl-10 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Brand panel — desktop / tablet landscape */}
      <aside
        className="hidden lg:flex lg:w-[min(44%,520px)] lg:shrink-0 flex-col justify-between border-r border-border bg-white px-10 xl:px-14 py-12"
        aria-hidden
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-muted">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">
            Rakamin AI Interview
          </span>
        </div>

        <div className="space-y-4 max-w-sm">
          <h2 className="text-2xl xl:text-3xl font-semibold text-foreground leading-tight tracking-tight">
            Assess candidates with AI-powered interviews
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign in to manage assessments, invite candidates, and review
            interview results from one dashboard.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Rakamin AI Interview
        </p>
      </aside>

      {/* Form */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile brand */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-muted mb-4">
              <LayoutDashboard className="h-7 w-7 text-primary" aria-hidden />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
              Rakamin AI Interview
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Sign in to your assessor account
            </p>
          </div>

          <div
            className={cn(
              "rounded-2xl border border-border bg-white shadow-sm shadow-black/[0.04]",
              "p-6 sm:p-8"
            )}
          >
            <div className="hidden lg:block mb-6">
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your credentials to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className={fieldClass}
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </div>

          <p className="lg:hidden text-center text-xs text-muted-foreground mt-6 px-2">
            Secure access for assessors and hiring teams
          </p>
        </div>
      </main>
    </div>
  );
}
