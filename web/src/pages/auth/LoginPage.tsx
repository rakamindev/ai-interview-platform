import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuth } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { getErrorCode } from "@/services/api";
import { m } from "@/paraglide/messages.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
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
      setAuth(res.data.access_token, res.data.user);
      navigate("/assessments");
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "tenant_unresolved") {
        setError(m.login_tenant_unresolved());
      } else if (code === "invalid_credentials") {
        setError(m.auth_invalid_credentials());
      } else {
        setError(m.common_error());
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{m.auth_login_title()}</h1>
          <p className="text-sm text-muted-foreground mt-1">{m.auth_signin_subtitle()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{m.auth_email()}</Label>
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
            <Label htmlFor="password">{m.auth_password()}</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {m.auth_sign_in()}
          </Button>
        </form>
      </div>
    </main>
  );
}
