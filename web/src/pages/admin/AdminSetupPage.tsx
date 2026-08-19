import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { adminInvitesApi } from "@/services/adminInvites";
import { Loader2, CheckCircle } from "lucide-react";

export default function AdminSetupPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    adminInvitesApi.show(token)
      .then((res) => {
        setEmail(res.data.email);
        setRole(res.data.role);
      })
      .catch((e: any) => setInvalid(e?.response?.data?.errors?.[0]?.message ?? "This invite link is invalid."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await adminInvitesApi.accept(token!, password, confirm);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to set up your account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-sm text-destructive">{invalid}</p>
        <p className="text-sm text-muted-foreground">
          Ask whoever invited you to send a new link.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center space-y-3">
        <CheckCircle className="h-8 w-8 text-primary mx-auto" />
        <p className="text-sm font-medium">Account created</p>
        <p className="text-sm text-muted-foreground">Redirecting you to log in...</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-lg font-semibold">Set up your account</h1>
        <p className="text-sm text-muted-foreground">
          {email} · {role}
        </p>
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create account
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
      </p>
    </div>
  );
}
