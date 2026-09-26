import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, KeyRound } from "lucide-react";

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
      setError("Invalid email or password. You can also use Quick Demo Sign In below.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({
        email: "admin@rakamin.com",
        password: "password123",
      });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch {
      const devToken = import.meta.env.VITE_DEV_TOKEN;
      if (devToken) {
        saveToken(devToken);
        setAuth({ token: devToken });
        navigate("/assessments");
      } else {
        setError("Quick demo sign-in failed. Please ensure the backend API is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAutofill = () => {
    setEmail("admin@rakamin.com");
    setPassword("password123");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">AI Interview Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in as Assessor / Recruiter</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 border rounded-xl shadow-xs">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="admin@rakamin.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sign in
          </Button>

          <div className="pt-2 border-t text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs text-primary font-medium flex items-center justify-center gap-1.5"
              onClick={handleQuickDemoLogin}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              ⚡ Quick Demo Sign In (Instant Access)
            </Button>
          </div>
        </form>

        {/* Demo Credentials Box */}
        <div className="border rounded-lg p-3 bg-muted/30 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <KeyRound className="h-3 w-3" /> Default Credentials:
            </span>
            <button
              type="button"
              className="text-primary hover:underline text-[11px] font-medium"
              onClick={handleAutofill}
            >
              Autofill Form
            </button>
          </div>
          <div className="space-y-0.5 text-muted-foreground font-mono">
            <p>Email: <span className="text-foreground">admin@rakamin.com</span></p>
            <p>Password: <span className="text-foreground">password123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
