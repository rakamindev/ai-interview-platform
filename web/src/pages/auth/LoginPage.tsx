import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import axios from "axios";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { roleFromToken } from "@/lib/jwt";
import { homePathForRole } from "@/lib/roles";
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
    const cleanEmail = email.trim();
    try {
      const res = await authApi.login({ email: cleanEmail, password });
      const { token, user } = res.data;
      const role = user?.role ?? roleFromToken(token);
      saveToken(token, user?.email);
      setAuth({ token, role, email: user?.email ?? null });
      navigate(homePathForRole(role));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          setError("Cannot connect to server. Please ensure the backend is running on port 3001.");
        } else if (err.response.status === 429) {
          const data = err.response.data as { error?: string } | undefined;
          setError(data?.error ?? "Too many login attempts. Please wait a minute and try again.");
        } else if (err.response.status === 401) {
          const data = err.response.data as { errors?: Array<{ message?: string }> } | undefined;
          setError(data?.errors?.[0]?.message ?? "Invalid email or password.");
        } else {
          const data = err.response.data as { errors?: Array<{ message?: string }>; error?: string; message?: string } | undefined;
          const msg = data?.errors?.[0]?.message ?? data?.error ?? data?.message;
          setError(msg ?? "Login failed. Please try again.");
        }
      } else {
        setError("Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">AI Interview</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sign in
          </Button>
        </form>

      </div>
    </div>
  );
}
