import { Navigate, Outlet } from "react-router-dom";
import { getStoredToken } from "@/stores/authAtom";
import { useUser } from "@/hooks/useUser";
import type { UserRole } from "@/services/auth";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const token = getStoredToken();
  const { role, loaded } = useUser();

  if (!token) return <Navigate to="/login" replace />;

  if (allowedRoles && loaded && !allowedRoles.includes(role as UserRole)) {
    // If user role is not permitted, redirect to their home
    return <Navigate to={role === "hiring_manager" ? "/candidates" : "/dashboard"} replace />;
  }

  return <Outlet />;
}
