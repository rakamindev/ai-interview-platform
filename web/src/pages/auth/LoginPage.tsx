import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken, saveUser, UserProfile } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ShieldCheck, ArrowRight, Award } from "lucide-react";
import { motion } from "framer-motion";
import { GoogleAccountModal } from "@/components/auth/GoogleAccountModal";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google OAuth state
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent, overrideEmail?: string, overridePass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = overrideEmail ?? email;
    const loginPass = overridePass ?? password;

    try {
      const res = await authApi.login({ email: loginEmail, password: loginPass });
      const token = res.data.token;
      const name = loginEmail === "admin@rakamin.com"
        ? "Admin Rakamin"
        : loginEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      const user: UserProfile = {
        id: res.data.user?.id,
        email: res.data.user?.email || loginEmail,
        name,
        role: res.data.user?.role,
      };
      saveToken(token);
      saveUser(user);
      setAuth({ token, user });
      navigate("/assessments");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    setEmail("admin@rakamin.com");
    setPassword("admin123");
    handleSubmit(undefined, "admin@rakamin.com", "admin123");
  };

  // Trigger Google Login
  const handleGoogleClick = () => {
    setError(null);
    setGoogleError(null);

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const google = (window as any).google;
    const isAutomatedTest = typeof navigator !== "undefined" && Boolean(navigator.webdriver);

    // If real Google Client ID is configured and GIS is available in window (and not in headless automation)
    if (clientId && google?.accounts?.oauth2 && !isAutomatedTest) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "email profile openid",
          prompt: "select_account",
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setError("Google sign-in was canceled or encountered an error.");
              return;
            }
            setLoading(true);
            try {
              const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const profile = await userInfoRes.json();
              const res = await authApi.loginGoogle({
                email: profile.email,
                credential: tokenResponse.access_token,
                name: profile.name,
                avatar_url: profile.picture,
              });
              const token = res.data.token;
              const user: UserProfile = {
                id: res.data.user?.id,
                email: profile.email || res.data.user?.email,
                name: profile.name || res.data.user?.name || profile.given_name || (profile.email ? profile.email.split("@")[0] : "Assessor"),
                picture: profile.picture || res.data.user?.avatar_url,
                avatar_url: profile.picture || res.data.user?.avatar_url,
                role: res.data.user?.role,
              };
              saveToken(token);
              saveUser(user);
              setAuth({ token, user });
              navigate("/assessments");
            } catch (err: any) {
              const msg = err?.response?.data?.errors?.[0]?.message || "Google sign-in failed. Please verify your assessor access.";
              setError(msg);
            } finally {
              setLoading(false);
            }
          },
        });
        client.requestAccessToken();
        return;
      } catch (e) {
        console.warn("Failed to initialize Google OAuth client, opening fallback chooser:", e);
      }
    }

    // Otherwise, open the interactive Google Account Chooser modal
    setGoogleModalOpen(true);
  };

  const handleSelectGoogleAccount = async (selectedEmail: string) => {
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      const name = selectedEmail === "admin@rakamin.com"
        ? "Admin Rakamin"
        : selectedEmail === "assessor@rakamin.com"
        ? "Assessor Rakamin"
        : selectedEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      const res = await authApi.loginGoogle({ email: selectedEmail, name });
      const token = res.data.token;
      const user: UserProfile = {
        id: res.data.user?.id,
        email: res.data.user?.email || selectedEmail,
        name: res.data.user?.name || name,
        picture: res.data.user?.avatar_url,
        avatar_url: res.data.user?.avatar_url,
        role: res.data.user?.role,
      };
      saveToken(token);
      saveUser(user);
      setAuth({ token, user });
      setGoogleModalOpen(false);
      navigate("/assessments");
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.[0]?.message || "Akses asesor ditolak untuk akun ini.";
      setGoogleError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 sm:p-6 bg-[#f8fafc] text-slate-800 overflow-hidden">
      {/* Subtle modern ambient background matching Rakamin teal & gold theme */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#01959f]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#fbc036]/15 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-[450px] space-y-6 relative z-10"
      >
        {/* Brand header — Clean Rakamin Logo */}
        <div className="flex items-center justify-center">
          <img
            src="/images/rakamin-logo.png"
            alt="Rakamin"
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </div>

        {/* Main Card — Pure white, modern soft radius and shadow */}
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/50 space-y-6">
          {/* Header inside card */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 tracking-tight">
              Sign In
            </h1>
            <p className="text-sm text-slate-500 font-normal">
              Welcome back! Please enter your details
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email input */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#01959f]/20 focus-visible:border-[#01959f] text-sm px-3.5 placeholder:text-slate-400 bg-white"
              />
            </div>

            {/* Password input */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#01959f]/20 focus-visible:border-[#01959f] text-sm px-3.5 pr-10 placeholder:text-slate-400 bg-white"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#01959f] focus:ring-[#01959f]/30 cursor-pointer"
                />
                <span>Remember for 30 Days</span>
              </label>
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(true)}
                className="font-medium text-[#01959f] hover:text-[#01808a] hover:underline transition-colors"
              >
                Forgot password
              </button>
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
                {error}
              </div>
            )}

            {/* Primary Action Button — Rakamin Theme Brand Teal */}
            <Button
              type="submit"
              aria-label="Sign In to Dashboard"
              className="w-full h-11 rounded-xl bg-[#01959f] hover:bg-[#01808a] active:bg-[#016f78] text-white font-bold text-sm shadow-md shadow-[#01959f]/20 transition-all duration-200 mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* OR Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400 font-medium tracking-wider">
                OR
              </span>
            </div>
          </div>

          {/* Side-by-Side Social & Fast Login Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              aria-label="Sign in with Google"
              onClick={handleGoogleClick}
              disabled={loading}
              className="w-full h-11 border-slate-200 hover:bg-slate-50 font-semibold text-xs text-slate-700 flex items-center justify-center gap-2 rounded-xl shadow-xs transition-all duration-200 hover:border-slate-300 px-3 whitespace-nowrap"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </Button>

            {/* 1-Click Fast Demo Login */}
            <Button
              type="button"
              variant="outline"
              aria-label="1-Click Sign In"
              onClick={handleQuickDemoLogin}
              disabled={loading}
              className="w-full h-11 border-slate-200 hover:bg-slate-50 font-semibold text-xs text-slate-700 flex items-center justify-center gap-2 rounded-xl shadow-xs transition-all duration-200 hover:border-slate-300 px-3 whitespace-nowrap"
            >
              <ShieldCheck className="h-4 w-4 text-[#01959f] shrink-0" />
              <span>1-Click Sign In</span>
            </Button>
          </div>

          {/* Demo account reminder */}
          <div className="text-center pt-1">
            <span className="text-[11px] text-slate-400">
              Assessor Demo: <strong className="font-semibold text-slate-600">admin@rakamin.com • admin123</strong>
            </span>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          Built with Monozukuri craftsmanship • Compliant with UU PDP No. 27/2022
        </p>
      </motion.div>

      {/* Info Dialog for Forgot Password */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Untuk mengatur ulang kata sandi akun asesor Anda, silakan hubungi Administrator organisasi atau IT Support.
            </p>
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                className="rounded-lg bg-[#01959f] hover:bg-[#01808a] text-white font-medium text-xs px-4"
                onClick={() => setForgotPasswordOpen(false)}
              >
                Mengerti
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Google Account Chooser Modal (when in local dev / without Google Client ID) */}
      <GoogleAccountModal
        open={googleModalOpen}
        onOpenChange={setGoogleModalOpen}
        onSelectAccount={handleSelectGoogleAccount}
        loading={googleLoading}
        error={googleError}
      />
    </div>
  );
}
