import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { tenantAtom, saveTenant } from "@/stores/tenantAtom";
import { queryClient } from "@/lib/queryClient";
import { authApi } from "../services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Sparkles, Building2, Check } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    tenant: "Test Corp",
    scheme: "test-corp",
    email: "admin@example.com",
    password: "password123",
    roleSummary: "Engineering · 2 Assessments · 2 Vacancies",
  },
  {
    tenant: "Acme Corp",
    scheme: "acme-corp",
    email: "admin@acme.com",
    password: "password123",
    roleSummary: "Product Mgmt · 1 Assessment · 2 Vacancies",
  },
] as const;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const setTenant = useSetAtom(tenantAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickFill = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const rawData = (res.data as any)?.data || res.data;
      const token = rawData?.token;
      if (!token) {
        throw new Error("Authentication succeeded but no token was provided.");
      }

      // Purge stale queries from previous session/tenant to guarantee multi-tenant data isolation
      queryClient.clear();

      saveToken(token);
      setAuth({ token });

      // Synchronize active tenant identity for navbar and headers
      const tenantData = rawData?.tenant;
      const userScheme = rawData?.user?.scheme;
      const tenantScheme =
        tenantData?.id ||
        userScheme ||
        (email.toLowerCase().includes("acme") ? "acme-corp" : "test-corp");
      const tenantName =
        tenantData?.name || (tenantScheme === "acme-corp" ? "Acme Corp" : "Test Corp");

      const activeTenant = { id: tenantScheme, name: tenantName };
      saveTenant(activeTenant);
      setTenant(activeTenant);

      navigate("/assessments");
    } catch (err: any) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.response?.data?.message ||
        (err.code === "ERR_NETWORK" || err.message === "Network Error" || !err.response
          ? "Unable to connect to the authentication server. Please check your network or ensure the backend is running."
          : "Invalid email or password.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Interview</h1>
          <p className="text-sm text-muted-foreground">Sign in to your assessor account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs sm:text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="assessor@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current-password">Password</Label>
            <Input
              id="current-password"
              name="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="done"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Fill Demo Accounts
            </span>
            <span className="text-[11px] text-muted-foreground">Multi-Tenant</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => {
              const isSelected = email === account.email && password === account.password;
              return (
                <button
                  key={account.scheme}
                  type="button"
                  onClick={() => handleQuickFill(account)}
                  aria-label={`Fill ${account.tenant} (${account.email})`}
                  className={`group flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background hover:border-primary/50 hover:bg-accent/40"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {account.tenant}
                    </span>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        Fill
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground truncate w-full">
                    {account.email}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
