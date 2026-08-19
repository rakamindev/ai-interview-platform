import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/shared/components/FormField";
import PasswordField from "@/shared/components/PasswordField";
import { useAuthForm } from "@/hooks/useAuthForm";
import { authApi, type SignupPayload } from "@/services/auth";
import { AUTH_COPY } from "@/utils/constants";

// Self-signup always creates a "user" account — role selection is not
// exposed here. Admin accounts are provisioned separately.
export default function SignupPage() {
  const { register, handleSubmit } = useForm<SignupPayload>();
  const { submit, loading, error } = useAuthForm(authApi.signup, {
    errorMessage: AUTH_COPY.signup.error,
  });

  return (
    <AuthLayout>
      <AuthCard
        title={AUTH_COPY.signup.title}
        description={AUTH_COPY.signup.description}
        footer={
          <span>
            {AUTH_COPY.signup.footerPrompt}{" "}
            <Link to="/login" className="text-primary hover:underline">
              {AUTH_COPY.signup.footerCta}
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
            autoComplete="new-password"
            {...register("password", { required: true })}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? AUTH_COPY.signup.submitting : AUTH_COPY.signup.submit}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
