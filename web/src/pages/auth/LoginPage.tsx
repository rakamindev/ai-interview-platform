import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { DEFAULT_TENANT_SCHEME, getTenantScheme, saveTenantScheme } from "@/stores/tenantAtom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantError = new URLSearchParams(location.search).get("reason") === "tenant";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const credentials = { email, password };
      const requestedScheme = getTenantScheme();
      let res: Awaited<ReturnType<typeof authApi.login>>;
      try {
        res = await authApi.login(credentials, requestedScheme);
      } catch (loginError) {
        if (requestedScheme === DEFAULT_TENANT_SCHEME) throw loginError;
        saveTenantScheme(DEFAULT_TENANT_SCHEME);
        res = await authApi.login(credentials, DEFAULT_TENANT_SCHEME);
      }
      const token = res.data.token;
      saveTenantScheme(requestedScheme === DEFAULT_TENANT_SCHEME ? requestedScheme : getTenantScheme());
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch (loginError) {
      saveTenantScheme(DEFAULT_TENANT_SCHEME);
      const details = loginError as {
        message?: string;
        response?: { status?: number; data?: { error?: string; message?: string } };
      };
      console.error("Login failed", {
        status: details.response?.status,
        message: details.response?.data?.error ?? details.response?.data?.message ?? details.message ?? "Unknown error",
      });
      setError("Invalid email or password.");
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

          {(error || tenantError) && (
            <p className="text-sm text-destructive">
              {error ?? "Your session is not authorized for tenant test-corp. Sign in with an assessor account that has an active test-corp membership."}
            </p>
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
