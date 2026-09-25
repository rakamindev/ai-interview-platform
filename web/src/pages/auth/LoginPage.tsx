import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Bot,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

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
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.error ??
        err?.response?.data?.errors?.[0]?.message ??
        err?.response?.data?.errors?.[0];
      setError(
        typeof serverMsg === "string" && serverMsg.trim()
          ? serverMsg
          : "Invalid email or password. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      {/* Left Column: Product Showcase & Brand Story (Desktop only) */}
      <div className="relative hidden lg:flex lg:w-1/2 bg-[#091524] text-white flex-col justify-between p-12 lg:p-16 overflow-hidden">
        {/* Ambient Decorative Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#01959F]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-[#FBC037]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-[#01959F]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Subtle Grid Background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#01959F] to-[#01c7d4] flex items-center justify-center shadow-lg shadow-[#01959F]/30 border border-[#01959F]/40">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">Rakamin</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-[#01959F]/20 text-[#01c7d4] border border-[#01959F]/30">
                AI Platform
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Talent Evaluation</p>
          </div>
        </div>

        {/* Main Content Showcase */}
        <div className="relative z-10 my-auto py-12 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#FBC037]" />
            <span>Next-Generation Technical Interviews</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Autonomous AI Interviewing &amp; Fit/Gap Intelligence
          </h1>

          <p className="text-sm sm:text-base text-slate-300/90 leading-relaxed font-normal">
            Conduct adaptive real-time conversational interviews, evaluate candidate competencies against standardized L1–L5 rubrics, and run automated Fit/Gap matching against job vacancies.
          </p>
        </div>
      </div>

      {/* Right Column: Modern Sign-In Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-background relative min-h-screen">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile Top Brand Header (< lg only) */}
          <div className="lg:hidden flex items-center gap-3 mb-2 pb-5 border-b border-border/60">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#01959F] to-[#01c7d4] flex items-center justify-center shadow-md shadow-[#01959F]/20 text-white shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-foreground">Rakamin</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#01959F]/10 text-[#01959F] border border-[#01959F]/20">
                  AI Platform
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Autonomous Talent Evaluation</p>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-1.5 text-left">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Sign In to Your Account
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your assessor credentials to access the platform.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email Address
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@rakamin.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm h-10 bg-background"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9 text-sm h-10 bg-background"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-sm font-semibold bg-[#01959F] hover:bg-[#017a82] active:scale-[0.99] text-white shadow-md shadow-[#01959F]/20 transition-all cursor-pointer mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
