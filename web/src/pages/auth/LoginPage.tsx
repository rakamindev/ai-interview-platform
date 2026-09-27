import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LayoutDashboard } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 bg-white p-8 border rounded-xl shadow-sm">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <LayoutDashboard className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Rakamin AI Interview</h1>
          <p className="text-sm text-muted-foreground">Sign in to your assessor account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="e.g. assessor@rakamin.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-md font-medium border border-destructive/20">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
            {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
