import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import AuthLayout from "@/features/auth/components/AuthLayout";
import AuthCard from "@/features/auth/components/AuthCard";
import FormField from "@/shared/components/FormField";
import PasswordField from "@/shared/components/PasswordField";
import InlineBanner from "@/shared/components/InlineBanner";
import { useAuthForm } from "@/features/auth/hooks/useAuthForm";
import { authApi, type LoginPayload } from "@/features/auth/services/auth";
import { AUTH_COPY } from "@/features/auth/constants";

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors: fieldErrors },
  } = useForm<LoginPayload>();
  const { submit, loading, error } = useAuthForm(authApi.login, {
    errorMessage: AUTH_COPY.login.error,
  });

  const displayError = error ?? (fieldErrors.email || fieldErrors.password ? AUTH_COPY.login.error : null);

  return (
    <AuthLayout>
      <AuthCard
        title={AUTH_COPY.login.title}
        description={AUTH_COPY.login.description}
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

          {displayError && <InlineBanner variant="error">{displayError}</InlineBanner>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? AUTH_COPY.login.submitting : AUTH_COPY.login.submit}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
