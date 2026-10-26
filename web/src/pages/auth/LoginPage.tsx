import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Layers,
  Terminal,
  Activity,
} from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationState = location.state as { message?: string; from?: { pathname: string } } | null;
  const successMessage = locationState?.message;
  // Where to go after login — defaults to /assessments
  const from = locationState?.from?.pathname || "/assessments";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }>; error?: string } };
      };
      const serverMsg =
        axiosErr.response?.data?.errors?.[0]?.message ||
        axiosErr.response?.data?.error;
      setError(serverMsg || "Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#02040b] text-slate-100 overflow-hidden px-4 py-12 selection:bg-blue-600 selection:text-white">
      {/* ── LAYER 1: Deep Cosmic / Aurora Lighting Backdrops ── */}
      {/* Primary Top Overhead Spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[950px] h-[600px] bg-gradient-to-b from-blue-600/35 via-cyan-500/20 to-transparent rounded-full blur-[140px] pointer-events-none" />

      {/* Ambient Side Orbs */}
      <div className="absolute -bottom-24 -left-24 w-[600px] h-[600px] bg-blue-700/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/3 -right-28 w-[550px] h-[550px] bg-cyan-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[130px] pointer-events-none" />

      {/* ── LAYER 2: Concentric Radar / Tech Rings ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full border border-blue-500/10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[860px] h-[860px] rounded-full border border-dashed border-blue-400/[0.08] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full border border-blue-400/[0.04] pointer-events-none" />

      {/* ── LAYER 3: Precision Dot-Matrix Grid with Vignette Mask ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(96, 165, 250, 0.22) 1.2px, transparent 1.2px)`,
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, #000 30%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, #000 30%, transparent 90%)",
        }}
      />

      {/* ── LAYER 4: Technical Telemetry Accents (Corners) ── */}
      <div className="absolute top-6 left-8 hidden lg:flex items-center gap-2 text-[11px] font-mono text-blue-400/40 select-none tracking-widest">
        <Terminal className="h-3.5 w-3.5 text-blue-400/50" />
        <span>SYS // CONSOLE_GATEWAY</span>
      </div>
      <div className="absolute top-6 right-8 hidden lg:flex items-center gap-2 text-[11px] font-mono text-blue-400/40 select-none tracking-widest">
        <Activity className="h-3.5 w-3.5 text-blue-400/50" />
        <span>NETWORK // ENCRYPTED_TLS</span>
      </div>
      <div className="absolute bottom-6 left-8 hidden lg:block text-[11px] font-mono text-blue-400/30 select-none tracking-widest">
        REGION // AP-SOUTHEAST-1
      </div>
      <div className="absolute bottom-6 right-8 hidden lg:block text-[11px] font-mono text-blue-400/30 select-none tracking-widest">
        PORT // 3001:V1
      </div>

      {/* ── LAYER 5: Main Form Container ── */}
      <div className="relative w-full max-w-[420px] z-10">
        {/* Living Blue Backlight Halo directly framing the card */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-blue-500/35 via-cyan-500/20 to-blue-600/30 blur-2xl opacity-80 pointer-events-none" />

        {/* The Blue Glass Form Card */}
        <div className="relative rounded-2xl bg-gradient-to-b from-[#0a183d]/95 via-[#061129]/95 to-[#030816]/98 border border-blue-500/40 shadow-[0_0_60px_-10px_rgba(37,99,235,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-2xl p-8 sm:p-9 overflow-hidden">
          {/* Top Edge Neon Highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-95" />

          {/* Clean Executive Header (Zero AI Slop) */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-11 w-11 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-[0_0_22px_rgba(59,130,246,0.35)] mb-4">
              <Layers className="h-5 w-5 text-blue-300" />
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Welcome back
            </h1>
            <p className="text-sm text-blue-200/60 mt-1.5">
              Sign in to your account to continue
            </p>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-6 p-3.5 text-xs text-emerald-200 bg-emerald-950/50 border border-emerald-400/40 rounded-xl flex items-start gap-2.5 backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-3.5 text-xs text-rose-200 bg-rose-950/50 border border-rose-500/40 rounded-xl flex items-start gap-2.5 backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field with Transparent Input */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-blue-100/85 tracking-wide"
              >
                Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-300/50 group-focus-within:text-blue-400 transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-transparent border border-blue-400/30 text-sm text-white placeholder:text-blue-300/35 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all hover:border-blue-400/55"
                />
              </div>
            </div>

            {/* Password Field with Transparent Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-blue-100/85 tracking-wide"
                >
                  Password
                </label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-300/50 group-focus-within:text-blue-400 transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-transparent border border-blue-400/30 text-sm text-white placeholder:text-blue-300/35 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all hover:border-blue-400/55"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-blue-300/50 hover:text-blue-300 transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-400 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(37,99,235,0.45)] hover:shadow-[0_4px_32px_rgba(37,99,235,0.65)] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer border border-blue-400/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-8 pt-6 border-t border-blue-500/20 text-center">
            <p className="text-xs text-blue-200/60">
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors inline-flex items-center gap-1 group ml-1"
              >
                Sign up
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </p>
          </div>
        </div>

        {/* Understated Security Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-blue-300/40">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-400/60" />
          <span>Enterprise Secure Authentication</span>
        </div>
      </div>
    </div>
  );
}
