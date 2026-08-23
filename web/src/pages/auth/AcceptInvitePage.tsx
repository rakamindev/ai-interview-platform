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
import { m } from "@/paraglide/messages.js";

const AcceptInviteSchema = z
  .object({
    password: z.string().min(8, m.auth.password_min()),
    password_confirmation: z.string()
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: m.auth.passwords_dont_match(),
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
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold">{m.auth.invalid_invite_link()}</h1>
          <p className="text-sm text-muted-foreground">{m.auth.invalid_invite()}</p>
          <Button variant="outline" onClick={() => navigate("/login")}>
            {m.auth.go_to_login()}
          </Button>
        </div>
      </main>
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
      setError(m.auth.invalid_invite());
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold">{m.auth.account_created()}</h1>
          <p className="text-sm text-muted-foreground">{m.auth.redirecting()}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{m.auth.accept_invite_title()}</h1>
          <p className="text-sm text-muted-foreground mt-1">{m.auth.create_account_subtitle()}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">{m.auth.password()}</Label>
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
            <Label htmlFor="password_confirmation">{m.auth.confirm_password()}</Label>
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
            {m.auth.create_account()}
          </Button>
        </form>
      </div>
    </main>
  );
}
