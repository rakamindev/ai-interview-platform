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
import { ArrowRight, Building2, Loader2 } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const setTenant = useSetAtom(tenantAtom);
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.signup({ organization_name: organizationName, email, password });
      saveToken(res.data.token);
      const tenant = { id: String(res.data.organization.id), name: res.data.organization.name, scheme: res.data.organization.scheme };
      saveTenant(tenant);
      setTenant(tenant);
      setAuth({ token: res.data.token });
      navigate("/assessments");
    } catch (requestError: any) {
      setError(requestError?.response?.data?.errors?.[0]?.message ?? "The workspace could not be created. Please review your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 space-y-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
          <p className="text-sm font-medium text-primary">Organization onboarding</p>
          <h2 className="text-2xl font-semibold tracking-tight">Create your assessment workspace</h2>
          <p className="text-sm leading-6 text-muted-foreground">The first account becomes the organization admin. Roles are assigned by the server and cannot be selected from the browser.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="organization">Organization name</Label><Input id="organization" placeholder="Acme Indonesia" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="email">Work email</Label><Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" placeholder="Minimum 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>

          {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</div>}

          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}Create workspace
          </Button>
        </form>

        <p className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
      </div>
    </AuthShell>
  );
}
