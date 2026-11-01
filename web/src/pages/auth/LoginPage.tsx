import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Notice from "@/components/Notice";
import BrandMark from "@/components/layout/BrandMark";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only a rejected login is the fields' fault; outages leave them unmarked.
  const [credentialsRejected, setCredentialsRejected] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCredentialsRejected(false);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch (requestError: unknown) {
      // Only a 401 means bad credentials; don't blame the password for an outage.
      const rejected = getApiErrorStatus(requestError) === 401;
      setCredentialsRejected(rejected);
      setError(
        rejected
          ? "Invalid email or password."
          : getApiErrorMessage(requestError, "Sign-in failed. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:grid lg:grid-cols-2 lg:gap-4">
      {/* Brand panel */}
      <aside className="bg-brand-gradient hidden flex-col justify-between rounded-[2rem] p-10 lg:flex">
        <Link to="/" aria-label="Rakamin AI Interview home" className="self-start">
          <BrandMark />
        </Link>
        <div className="max-w-md space-y-4">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Every rating, <em className="font-serif font-normal italic text-primary">backed</em> by
            what the candidate said
          </h2>
          <p className="text-rakamin-charcoal/80">
            Set up skill assessments, follow interviews live, and review evidence-based portfolios
            in one workspace.
          </p>
        </div>
        <p className="text-xs text-rakamin-charcoal/70">For assessors and hiring teams</p>
      </aside>

      <div className="flex min-h-[calc(100vh-1.5rem)] flex-col">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" aria-label="Rakamin AI Interview home" className="lg:hidden">
            <BrandMark />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to your assessor workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={credentialsRejected || undefined}
                  aria-describedby={credentialsRejected ? "login-error" : undefined}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={credentialsRejected || undefined}
                  aria-describedby={credentialsRejected ? "login-error" : undefined}
                  required
                />
              </div>

              {error && (
                <div id="login-error">
                  <Notice variant="error">{error}</Notice>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                Sign in
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Need access? Ask your workspace admin to create an account for you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
