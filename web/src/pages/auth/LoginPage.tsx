import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import {
  ArrowRight,
  AudioLines,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  Loader2,
  Code2,
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const response = await authApi.login({
        email: email.trim(),
        password,
      });

      const token = response.data.token;

      saveToken(token);
      localStorage.setItem("auth_email", email.trim());
      setAuth({ token });

      navigate("/dashboard", { replace: true });
    } catch {
      setError("Email atau password tidak sesuai. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-[#f6f9f9] text-slate-900 lg:p-4">
      <section className="relative hidden min-h-[calc(100vh-2rem)] w-[52%] flex-col overflow-hidden rounded-[28px] bg-primary p-10 text-white lg:flex xl:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-28 -top-28 h-[420px] w-[420px] rounded-full border-[75px] border-white/10" />
          <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full border-[85px] border-white/10" />
          <div className="absolute left-[58%] top-[22%] h-40 w-40 rounded-full bg-white/10 blur-[90px]" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary shadow-lg shadow-black/10">
            <Code2 className="h-6 w-6" aria-hidden="true" />
          </span>

          <div>
            <p className="text-lg font-bold leading-tight tracking-tight">Rakamin</p>
            <p className="text-xs font-medium tracking-[.16em] text-white/75">AI INTERVIEW</p>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-[590px] py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold tracking-wide backdrop-blur-sm">
            <Code2 className="h-4 w-4 text-[#ffe39a]" />
            Your smarter recruitment workspace
          </span>

          <h1 className="mt-7 max-w-[560px] text-4xl font-extrabold leading-[1.15] tracking-[-.035em] xl:text-[54px]">
            Better interviews.
            <br />
            <span className="text-[#ffe39a]">Smarter hiring.</span>
          </h1>

          <p className="mt-5 max-w-[475px] text-base leading-7 text-white/85">
            One workspace to manage assessments, conduct AI-assisted interviews, and turn candidate
            insights into confident hiring decisions.
          </p>

          <div className="relative mt-11 max-w-[490px] rounded-[24px] border border-white/25 bg-white/15 p-4 shadow-2xl shadow-black/10 backdrop-blur-md sm:p-5">
            <div className="flex items-center justify-between border-b border-white/20 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                  <AudioLines className="h-5 w-5" aria-hidden="true" />
                </span>

                <div>
                  <p className="text-sm font-semibold">AI Interview Workspace</p>
                  <p className="text-xs text-white/70">Your recruitment, simplified</p>
                </div>
              </div>

              <span className="rounded-full bg-[#ffe39a] px-3 py-1 text-[11px] font-bold text-[#675012]">
                AI powered
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "Assessments", icon: Check },
                { label: "Interviews", icon: AudioLines },
                { label: "Insights", icon: Sparkles },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex min-h-[94px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/15 p-2 text-center"
                >
                  <span className="rounded-xl bg-white/20 p-2.5">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <span className="text-xs font-semibold">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>


      </section>

      <section className="flex w-full flex-1 items-center justify-center px-6 py-12 sm:px-12 lg:px-10 xl:px-20">
        <div className="w-full max-w-[430px]">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </span>

            <div>
              <p className="text-lg font-bold leading-tight">Rakamin</p>
              <p className="text-xs font-semibold tracking-[.15em] text-primary">AI INTERVIEW</p>
            </div>
          </div>

          <div className="mb-9">
            <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              Welcome back
            </span>

            <h2 className="mt-5 text-3xl font-extrabold tracking-[-.035em] text-slate-900 sm:text-[38px]">
              Sign in to your account
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Enter your credentials to access your recruitment workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Email address
              </Label>

              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />

                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(error)}
                  className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm shadow-sm shadow-slate-100 placeholder:text-slate-400 focus-visible:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Password
              </Label>

              <div className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />

                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(error)}
                  className="h-12 rounded-xl border-slate-200 bg-white pl-11 pr-12 text-sm shadow-sm shadow-slate-100 placeholder:text-slate-400 focus-visible:ring-primary"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">Rakamin AI Interview Platform - 2026</p>
        </div>
      </section>
    </main>
  );
}