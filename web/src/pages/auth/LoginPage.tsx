import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[#087f87] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div
            aria-hidden="true"
            className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-40 -left-28 h-[28rem] w-[28rem] rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute right-16 top-1/3 h-48 w-48 rounded-full bg-white/[0.04]"
          />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">
                AI Interview
              </p>
              <p className="text-xs text-white/70">
                Intelligent hiring platform
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-lg py-16">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-teal-100">
              Hire with confidence
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Better interviews.
              <br />
              Better decisions.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/75">
              Manage assessments, review candidate performance, and make
              informed hiring decisions in one place.
            </p>

            <div className="mt-10 space-y-4">
              {[
                "Structured AI-assisted interviews",
                "Clear candidate evaluation reports",
                "Skills-based fit and gap analysis",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-200" />
                  <span className="text-sm text-white/90">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-white/60">
            <ShieldCheck className="h-4 w-4" />
            Designed to support a more structured hiring process
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10 lg:min-h-0 lg:px-12 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087f87] text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight">
                    AI Interview
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Intelligent hiring platform
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-[#087f87]">
                Welcome back
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Sign in to your account
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Enter your credentials to access your assessment dashboard.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Masuk untuk mengelola assessment dan hasil interview kandidat.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-10 pr-12"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full bg-[#087f87] font-medium text-white hover:bg-[#066b72]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#087f87]" />
              <div>
                <p className="text-sm font-medium">Secure access</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Your account provides access to your authorized assessment
                  data and reports.
                </p>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              AI Interview Platform
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}