import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, Mail, Lock, Mic, AlertCircle } from "lucide-react";

// ── Simple inline validation (menutup gap P2-6: zod terinstall tapi belum dipakai) ──
function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email wajib diisi.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Format email tidak valid.";
  return null;
}
function validatePassword(password: string): string | null {
  if (!password) return "Password wajib diisi.";
  if (password.length < 6) return "Password minimal 6 karakter.";
  return null;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const validateFields = () => {
    const errors: { email?: string; password?: string } = {};
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr) errors.email = emailErr;
    if (passErr) errors.password = passErr;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errors: { email?: string; password?: string } = { ...fieldErrors };
    if (field === "email") {
      const err = validateEmail(email);
      if (err) errors.email = err;
      else delete errors.email;
    }
    if (field === "password") {
      const err = validatePassword(password);
      if (err) errors.password = err;
      else delete errors.password;
    }
    setFieldErrors(errors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!validateFields()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch {
      setError("Email atau password salah. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("admin@example.com");
    setPassword("password");
    setFieldErrors({});
    setTouched({});
    setError(null);
  };

  const isFormValid = email.trim().length > 0 && password.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* ── Decorative background blobs ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(184 99% 31%), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(43 96% 60%), transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, hsl(184 99% 31%), transparent 70%)" }}
        />
      </div>

      {/* ── Login Card ── */}
      <Card className="relative w-full max-w-md mx-4 shadow-2xl border border-border/60 bg-card/95 backdrop-blur-sm">
        <CardHeader className="pb-2 pt-8 px-8 text-center">
          {/* Brand icon */}
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
            style={{
              background: "linear-gradient(135deg, hsl(184 99% 31%), hsl(184 99% 42%))",
            }}
          >
            <Mic className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Interview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-Powered Candidate Assessment Platform
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8 pt-4">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* ── Email field ── */}
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="Masukkan email Anda..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur("email")}
                  className={`pl-9 transition-colors ${
                    touched.email && fieldErrors.email
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }`}
                />
              </div>
              {touched.email && fieldErrors.email && (
                <p className="flex items-center gap-1.5 text-xs text-destructive animate-in slide-in-from-top-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* ── Password field ── */}
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur("password")}
                  className={`pl-9 pr-10 transition-colors ${
                    touched.password && fieldErrors.password
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {touched.password && fieldErrors.password && (
                <p className="flex items-center gap-1.5 text-xs text-destructive animate-in slide-in-from-top-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* ── API-level error ── */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 animate-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* ── Submit button ── */}
            <Button
              id="login-submit"
              type="submit"
              className="w-full h-10 font-semibold transition-all duration-200"
              disabled={!isFormValid || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* ── Demo credentials hint ── */}
          <button
            type="button"
            onClick={fillDemo}
            className="mt-5 w-full rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-center hover:bg-muted/70 transition-colors cursor-pointer"
            aria-label="Isi otomatis dengan kredensial demo"
          >
            <p className="text-xs font-medium text-muted-foreground">
              💡 <span className="font-semibold">Demo Login</span> — klik untuk isi otomatis
            </p>
            <p className="text-xs text-muted-foreground/80 mt-0.5 font-mono">
              admin@example.com&nbsp;&nbsp;/&nbsp;&nbsp;password
            </p>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
