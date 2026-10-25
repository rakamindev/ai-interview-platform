import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useForm } from "react-hook-form";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import {
  adminInvitationsApi,
  type PublicAdminInvitation,
} from "@/services/adminInvitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/alert";
import { extractApiError } from "@/lib/apiErrors";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignupFormValues {
  email: string;
  password: string;
}

type InvitationState = "loading" | "valid" | "missing" | "unavailable" | "network_error";

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get("invitation")?.trim() ?? "";
  const [invitationState, setInvitationState] = useState<InvitationState>(
    invitationToken ? "loading" : "missing"
  );
  const [invitation, setInvitation] = useState<PublicAdminInvitation | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignupFormValues>({
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const validateInvitation = useCallback(async () => {
    if (!invitationToken) {
      setInvitationState("missing");
      setInvitation(null);
      return;
    }

    setInvitationState("loading");
    setInvitation(null);
    try {
      const response = await adminInvitationsApi.validate(invitationToken);
      setInvitation(response.data.invitation);
      reset({ email: response.data.invitation.recipient_email, password: "" });
      setInvitationState("valid");
    } catch (err) {
      const apiError = extractApiError(err);
      setInvitationState(apiError.code === "network_error" ? "network_error" : "unavailable");
    }
  }, [invitationToken, reset]);

  useEffect(() => {
    void validateInvitation();
  }, [validateInvitation, retryKey]);

  const onSubmit = async (data: SignupFormValues) => {
    if (!invitationToken || !invitation) return;

    setError(null);
    setLoading(true);
    try {
      const response = await authApi.signup({
        invitation_token: invitationToken,
        email: data.email,
        password: data.password,
      });
      const token = response.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError.message);
      if (apiError.code === "invalid_invitation") setInvitationState("unavailable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-2 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">AI Interview</h1>
          <p className="text-sm text-muted-foreground mt-1">Create an administrator account</p>
        </div>

        {invitationState === "loading" && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Validating invitation…
          </div>
        )}

        {invitationState === "missing" && (
          <Alert>
            <p className="font-medium">An administrator invitation is required.</p>
            <p className="mt-1 text-xs">Ask an existing administrator to create a new invitation for your email address.</p>
          </Alert>
        )}

        {invitationState === "unavailable" && (
          <Alert>
            <p className="font-medium">This invitation is unavailable.</p>
            <p className="mt-1 text-xs">It may be invalid, expired, revoked, or already used. Ask an administrator for a new invitation.</p>
          </Alert>
        )}

        {invitationState === "network_error" && (
          <div className="space-y-3">
            <Alert>
              <p className="font-medium">Unable to validate the invitation.</p>
              <p className="mt-1 text-xs">Check your connection and try again.</p>
            </Alert>
            <Button type="button" variant="outline" className="w-full" onClick={() => setRetryKey((key) => key + 1)}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        )}

        {invitationState === "valid" && invitation && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                value={invitation.organization.name}
                disabled
                readOnly
                aria-describedby="organization-help"
              />
              <p id="organization-help" className="text-xs text-muted-foreground">
                Assigned by the invitation and cannot be changed.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" readOnly {...register("email")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                aria-invalid={errors.password ? true : undefined}
                className={cn(errors.password && "border-destructive focus-visible:ring-destructive/40")}
                {...register("password", {
                  required: "Password is required.",
                  minLength: { value: 8, message: "Password must be between 8 and 72 characters." },
                  maxLength: { value: 72, message: "Password must be between 8 and 72 characters." },
                })}
              />
              {errors.password && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <Alert>
                <p className="text-sm">{error}</p>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign up
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
