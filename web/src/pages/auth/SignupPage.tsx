import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSetAtom } from "jotai";
import axios from "axios";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";
import { useCapsLock } from "@/hooks/useCapsLock";

type FieldErrors = Partial<Record<"email" | "password", string>>;

function extractFieldErrors(err: unknown): FieldErrors {
  if (axios.isAxiosError(err) && err.response?.data?.errors?.[0]?.detail) {
    const detail = err.response.data.errors[0].detail;
    const fields: FieldErrors = {};
    if (typeof detail === "object" && detail !== null) {
      for (const [field, messages] of Object.entries(detail)) {
        if (Array.isArray(messages) && messages.length > 0) {
          fields[field as keyof FieldErrors] = messages[0];
        }
      }
    }
    return fields;
  }
  return {};
}

function signupErrorText(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Cannot reach the server. Check your connection and try again.";
    if (err.response.status === 422) {
      return "Signup failed. Check the highlighted fields and try again.";
    }
  }
  return "Signup failed. Check your details and try again.";
}

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { capsLock, onKeyDown, onKeyUp } = useCapsLock();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await authApi.signup({ email: email.trim(), password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      void navigate("/assessments");
    } catch (err) {
      setFieldErrors(extractFieldErrors(err));
      setError(signupErrorText(err));
    } finally {
      setLoading(false);
    }
  };

  const passwordDescribedBy = [
    fieldErrors.password ? "password-error" : null,
    capsLock ? "capslock-hint" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start assessing candidates with AI-conducted interviews."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            required
          />
          {fieldErrors.email && (
            <p id="email-error" role="alert" className="text-sm text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={passwordDescribedBy || undefined}
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          {capsLock && (
            <p id="capslock-hint" role="status" className="text-sm text-muted-foreground">
              Caps Lock is on.
            </p>
          )}
          {fieldErrors.password && (
            <p id="password-error" role="alert" className="text-sm text-destructive">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {error && (
          <p id="signup-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
          {loading ? "Creating account…" : "Sign up"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
