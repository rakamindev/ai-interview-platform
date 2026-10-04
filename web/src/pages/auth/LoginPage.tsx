import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-[420px]">
        {/* Official Rakamin Logo (Left-aligned above card like app.rakamin.com/login) */}
        <div className="mb-6">
          <img
            src="/rakamin-logo.png"
            alt="Rakamin"
            className="h-7 w-auto object-contain"
          />
        </div>

        <div className="w-full bg-card rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/60 p-8 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">Login to Rakamin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Don't have an account?{" "}
              <a href="#register" onClick={(e) => e.preventDefault()} className="text-primary hover:underline font-medium">
                Register using email
              </a>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground font-medium">
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
                className="h-10 text-sm"
              />
            </div>

            {showPassword && (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-muted-foreground font-medium">
                  Kata Sandi
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={showPassword}
                  className="h-10 text-sm"
                />
              </div>
            )}

            {error && (
              <div role="alert" className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#FBC037] hover:bg-[#FBC037]/90 text-[#404040] font-semibold h-10 shadow-none"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {showPassword ? "Masuk" : "Send Link"}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground">atau</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 font-semibold text-xs text-foreground border-border"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                <svg className="w-4 h-4 mr-2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                {showPassword ? "Masuk dengan Magic Link" : "Masuk dengan kata sandi"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 font-semibold text-xs text-foreground border-border"
                onClick={() => {
                  alert("Google login is not available in this demo environment.");
                }}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Masuk dengan Google
              </Button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
