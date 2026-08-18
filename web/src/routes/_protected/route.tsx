import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getStoredToken } from "@/stores/auth-atom";
import { AppLayout } from "@/components/layout/app-layout";

export const Route = createFileRoute("/_protected")({
  beforeLoad: () => {
    const token = getStoredToken();
    if (!token) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
