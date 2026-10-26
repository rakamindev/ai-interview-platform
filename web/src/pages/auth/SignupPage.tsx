import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Layers,
  User,
  Shield,
  Terminal,
  Activity,
} from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"admin" | "user">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.signup({ email, password, role });
      navigate("/login", {
        state: { message: "Account created successfully! Please sign in with your credentials." },
      });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }>; error?: string } };
      };
      const serverMsg =
        axiosErr.response?.data?.errors?.[0]?.message ||
        axiosErr.response?.data?.error;
      setError(serverMsg || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#02040b] text-slate-100 overflow-hidden px-4 py-12 selection:bg-blue-600 selection:text-white">
      {/* ── LAYER 1: Deep Cosmic / Aurora Lighting Backdrops ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[950px] h-[600px] bg-gradient-to-b from-blue-600/35 via-cyan-500/20 to-transparent rounded-full blur-[140px] pointer-events-none" />
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
        <span>SYS // REGISTER_GATEWAY</span>
      </div>
      <div className="absolute top-6 right-8 hidden lg:flex items-center gap-2 text-[11px] font-mono text-blue-400/40 select-none tracking-widest">
        <Activity className="h-3.5 w-3.5 text-blue-400/50" />
        <span>NETWORK // ENCRYPTED_TLS</span>
      </div>

      {/* ── LAYER 5: Main Form Container ── */}
      <div className="relative w-full max-w-[440px] z-10">
        {/* Living Blue Backlight Halo */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-blue-500/35 via-cyan-500/20 to-blue-600/30 blur-2xl opacity-80 pointer-events-none" />

        {/* The Blue Glass Form Card */}
        <div className="relative rounded-2xl bg-gradient-to-b from-[#0c1a3f]/95 via-[#08132f]/95 to-[#040a1b]/98 border border-blue-500/40 shadow-[0_0_50px_-8px_rgba(37,99,235,0.35),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-2xl p-8 sm:p-9 overflow-hidden">
          {/* Top Edge Neon Highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-90" />

          {/* Clean Executive Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-11 w-11 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-[0_0_22px_rgba(59,130,246,0.35)] mb-4">
              <Layers className="h-5 w-5 text-blue-300" />
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Create an account
            </h1>
            <p className="text-sm text-blue-200/60 mt-1.5">
              Get started with your assessor console
            </p>
          </div>

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
                Work Email
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
              <label
                htmlFor="password"
                className="block text-xs font-medium text-blue-100/85 tracking-wide"
              >
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-300/50 group-focus-within:text-blue-400 transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Minimum 6 characters"
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

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-blue-100/85 tracking-wide">
                Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("user")}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    role === "user"
                      ? "bg-blue-600/25 border-blue-400 text-white shadow-[0_0_18px_rgba(37,99,235,0.35)]"
                      : "bg-transparent border-blue-400/25 text-blue-200/60 hover:border-blue-400/45 hover:bg-blue-900/10"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      role === "user"
                        ? "bg-blue-500/30 text-blue-300"
                        : "bg-blue-950/40 text-blue-400/50"
                    }`}
                  >
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">User</div>
                    <div className="text-[11px] text-blue-300/50">Standard access</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    role === "admin"
                      ? "bg-blue-600/25 border-blue-400 text-white shadow-[0_0_18px_rgba(37,99,235,0.35)]"
                      : "bg-transparent border-blue-400/25 text-blue-200/60 hover:border-blue-400/45 hover:bg-blue-900/10"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      role === "admin"
                        ? "bg-blue-500/30 text-blue-300"
                        : "bg-blue-950/40 text-blue-400/50"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">Admin</div>
                    <div className="text-[11px] text-blue-300/50">Full management</div>
                  </div>
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
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-8 pt-6 border-t border-blue-500/20 text-center">
            <p className="text-xs text-blue-200/60">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors inline-flex items-center gap-1 group ml-1"
              >
                Sign in
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
