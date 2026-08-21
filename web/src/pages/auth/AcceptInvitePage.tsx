import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { authApi } from "@/services/auth";
import { setAuth } from "@/stores/authAtom";

const AcceptInviteSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    password_confirmation: z.string()
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"]
  });

type AcceptInviteFormValues = z.infer<typeof AcceptInviteSchema>;

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(AcceptInviteSchema)
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold">Invalid Invite Link</h1>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid or missing a token. Please contact your administrator for a
            new invite.
          </p>
          <Button variant="outline" onClick={() => navigate("/login")}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: AcceptInviteFormValues) => {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.acceptInvite({
        token,
        password: data.password
      });
      setAuth(res.data.access_token, res.data.user);
      setSuccess(true);
      setTimeout(() => navigate("/assessments"), 1500);
    } catch {
      setError("Invalid or expired invite link. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold">Account Created</h1>
          <p className="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Accept Invite</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your account to get started</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password_confirmation">Confirm password</Label>
            <Input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              {...register("password_confirmation")}
            />
            {errors.password_confirmation && (
              <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Account
          </Button>
        </form>
      </div>
    </div>
  );
}
