import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/shared/components/FormField";
import PasswordField from "@/shared/components/PasswordField";
import { useAuthForm } from "@/hooks/useAuthForm";
import { authApi, type LoginPayload } from "@/services/auth";
import { AUTH_COPY } from "@/utils/constants";

export default function LoginPage() {
  const { register, handleSubmit } = useForm<LoginPayload>();
  const { submit, loading, error } = useAuthForm(authApi.login, {
    errorMessage: AUTH_COPY.login.error,
  });

  return (
    <AuthLayout>
      <AuthCard
        title={AUTH_COPY.login.title}
        description={AUTH_COPY.login.description}
        footer={
          <span>
            {AUTH_COPY.login.footerPrompt}{" "}
            <Link to="/signup" className="text-primary hover:underline">
              {AUTH_COPY.login.footerCta}
            </Link>
          </span>
        }
      >
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            {...register("email", { required: true })}
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            {...register("password", { required: true })}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? AUTH_COPY.login.submitting : AUTH_COPY.login.submit}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
