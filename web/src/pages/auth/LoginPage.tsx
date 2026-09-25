import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { saveTenant, tenantAtom } from "@/stores/tenantAtom";
import { authApi } from "@/services/auth";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const setTenant = useSetAtom(tenantAtom);
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
      saveToken(res.data.token);
      const tenant = {
        id: String(res.data.organization.id),
        name: res.data.organization.name,
        scheme: res.data.organization.scheme,
      };
      saveTenant(tenant);
      setTenant(tenant);
      setAuth({ token: res.data.token });
      navigate("/assessments");
    } catch (requestError: any) {
      setError(requestError?.response?.data?.errors?.[0]?.message ?? "We could not sign you in. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 space-y-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary lg:hidden">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-primary">Welcome back</p>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h2>
          <p className="text-sm leading-6 text-muted-foreground">Review assessments, candidate evidence, and fit/gap analysis from one workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</div>}

          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Sign in
          </Button>
        </form>

        <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
          New organization? <Link to="/signup" className="font-medium text-primary hover:underline">Create a workspace</Link>
        </div>

        <div className="mt-4 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
          Local demo after <code>rails db:seed</code>: <strong>test@test.com</strong> / <strong>test1234</strong>
        </div>
      </div>
    </AuthShell>
  );
}
