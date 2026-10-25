import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useForm } from "react-hook-form";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/alert";
import { extractApiError } from "@/lib/apiErrors";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors the backend User validation (URI::MailTo::EMAIL_REGEXP) — same
// pattern used by SignupPage.
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  // Surface a "session expired" notice after the axios interceptor redirected
  // us here with the auth_expired flag set (F-26 AC#5).
  useEffect(() => {
    const expired = sessionStorage.getItem("auth_expired");
    if (expired) {
      sessionStorage.removeItem("auth_expired");
      setNotice("Your session has expired. Please sign in again.");
    }
  }, []);

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      // F-03 phase 2: clean login — tenant is derived from the account's
      // organization server-side, there is no tenant input anymore.
      const res = await authApi.login({ email: data.email, password: data.password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch (err) {
      // F-03 AC#9 / F-26: surface the real backend error (e.g. account not
      // assigned to an organization, rate limit, network failure) instead of
      // a misleading generic credential message.
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-2">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">AI Interview</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={errors.email ? true : undefined}
              className={cn(errors.email && "border-destructive focus-visible:ring-destructive/40")}
              {...register("email", {
                required: "Email is required.",
                pattern: { value: EMAIL_PATTERN, message: "Enter a valid email address." },
              })}
            />
            {errors.email && (
              <p className="text-xs text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              className={cn(errors.password && "border-destructive focus-visible:ring-destructive/40")}
              {...register("password", { required: "Password is required." })}
            />
            {errors.password && (
              <p className="text-xs text-destructive" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {notice && (
            <Alert variant="info">
              <p className="text-sm">{notice}</p>
            </Alert>
          )}
          {error && (
            <Alert>
              <p className="text-sm">{error}</p>
            </Alert>
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
