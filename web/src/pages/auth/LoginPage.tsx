import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveAuth } from "@/stores/authAtom";
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
      const user = res.data.user || { email, role: "admin" };
      saveAuth(token, user);
      setAuth({ token, user });
      navigate("/assessments");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail("admin@example.com");
    setPassword("password");
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4 py-8">
      <div className="w-full max-w-md bg-white border rounded-xl p-8 space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your administrator credentials to access the assessment workspace.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="p-3 bg-muted/40 rounded-lg border text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Demo Administrator Account</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-primary hover:text-primary"
              onClick={handleFillDemo}
            >
              Auto-fill
            </Button>
          </div>
          <div className="space-y-0.5 font-mono text-[11px]">
            <div>Email: admin@example.com</div>
            <div>Password: password</div>
          </div>
        </div>
      </div>
    </div>
  );
}
