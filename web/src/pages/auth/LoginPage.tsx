import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useSetAtom } from "jotai";
import axios from "axios";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";
import { useCapsLock } from "@/hooks/useCapsLock";

function loginErrorText(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Cannot reach the server. Check your connection and try again.";
    if (err.response.status === 401) {
      return "Invalid email or password. Check your credentials and try again.";
    }
  }
  return "Something went wrong on our end. Please try again in a moment.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { capsLock, onKeyDown, onKeyUp } = useCapsLock();

  useEffect(() => {
    if (location.state?.sessionExpired) setSessionExpired(true);
    const onExpired = () => setSessionExpired(true);
    window.addEventListener("auth:session-expired", onExpired);
    return () => window.removeEventListener("auth:session-expired", onExpired);
  }, [location.state?.sessionExpired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      setSessionExpired(false);
      void navigate("/assessments");
    } catch (err) {
      setError(loginErrorText(err));
    } finally {
      setLoading(false);
    }
  };

  const passwordDescribedBy = [error ? "login-error" : null, capsLock ? "capslock-hint" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to review AI-conducted interviews and assessments."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {sessionExpired && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            Your session expired. Sign in again to continue.
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
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
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            aria-invalid={error ? true : undefined}
            aria-describedby={passwordDescribedBy || undefined}
            required
          />
          {capsLock && (
            <p id="capslock-hint" role="status" className="text-sm text-muted-foreground">
              Caps Lock is on.
            </p>
          )}
        </div>

        {error && (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to AI Interview?{" "}
        <Link to="/signup" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
