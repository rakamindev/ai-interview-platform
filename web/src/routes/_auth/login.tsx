import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthLayout } from "@/components/layout/auth-layout";
import { LoginForm } from "@/features/auth/components/login-form";
import { getStoredToken } from "@/stores/auth-atom";

export const Route = createFileRoute("/_auth/login")({
  beforeLoad: () => {
    const token = getStoredToken();
    if (token) {
      throw redirect({
        to: "/",
      });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
