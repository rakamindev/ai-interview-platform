import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login({ email: cleanEmail, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch {
      setError("Invalid email or password. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFillDemo = () => {
    setEmail("admin@testcorp.com");
    setPassword("password123");
    setError(null);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-950 text-slate-100 selection:bg-teal-500 selection:text-white">
      {/* Background Animated Gradient Mesh / Ambient Glowing Spheres */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Frozen Glass Card Container */}
      <div className="relative w-full max-w-md mx-4 z-10">
        <div className="backdrop-blur-2xl bg-white/10 dark:bg-slate-900/60 border border-white/20 dark:border-slate-800/80 shadow-2xl rounded-3xl p-8 space-y-6">
          
          {/* Header & Branding with Official Rakamin Logo */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/90 shadow-lg border border-white/40 mb-1">
              <img
                src="/rakamin-logo.png"
                alt="Rakamin Logo"
                className="h-9 object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-teal-200 bg-clip-text text-transparent">
                AI Evaluation Platform
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Enterprise Candidate Competency &amp; Fit/Gap Assessment
              </p>
            </div>
          </div>

          {/* Quick Demo Credentials Fill Button */}
          <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-teal-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-400" />
              <span>Evaluator Demo Admin Account</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuickFillDemo}
              className="h-7 text-xs bg-teal-500/10 border-teal-500/30 text-teal-200 hover:bg-teal-500/20 hover:text-white"
            >
              Fill Demo Login
            </Button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-300">
                Work Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@testcorp.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-950/50 border-slate-700/60 focus:border-teal-400 focus:ring-teal-400/20 text-white placeholder:text-slate-500 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-slate-950/50 border-slate-700/60 focus:border-teal-400 focus:ring-teal-400/20 text-white placeholder:text-slate-500 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 focus:outline-none"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-semibold shadow-lg shadow-teal-500/20 transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In to Dashboard"
              )}
            </Button>
          </form>

          {/* Footer Security Badges */}
          <div className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" /> UU PDP Compliant
            </span>
            <span>·</span>
            <span>256-bit JWT Authenticated</span>
          </div>

        </div>
      </div>
    </div>
  );
}
