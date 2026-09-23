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

  return (
    <div className="min-h-screen flex flex-col justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto space-y-10">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
            Assessor access
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
            Rakamin
            <br />
            <span className="text-primary">AI Interview</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Sign in to configure assessments, invite candidates, and review skill evidence.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 border-t border-foreground/10 pt-8">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-card/80"
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
              className="bg-card/80"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="border border-destructive/35 bg-destructive/[0.04] px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
