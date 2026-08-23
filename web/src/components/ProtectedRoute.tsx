import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getAuthState, onAuthChange } from "@/stores/authAtom";

// Mirrors the backend's ASSESSOR_ROLES grouping (see
// api/app/auth/authorize_api_request.rb) — "assessor" access admits both
// the "admin" and "assessor" membership roles.
const ASSESSOR_ROLES = new Set(["admin", "assessor"]);

interface ProtectedRouteProps {
  isAuthReady: boolean;
  requiredRole?: "admin" | "assessor";
}

export default function ProtectedRoute({ isAuthReady, requiredRole }: ProtectedRouteProps) {
  const [auth, setAuth] = useState(getAuthState);

  useEffect(() => {
    return onAuthChange(() => setAuth(getAuthState()));
  }, []);

  if (!isAuthReady) return null;
  if (!auth.accessToken) return <Navigate to="/login" replace />;

  if (requiredRole) {
    const role = auth.user?.role ?? "";
    const allowed = requiredRole === "assessor" ? ASSESSOR_ROLES.has(role) : role === requiredRole;
    if (!allowed) return <Navigate to="/assessments" replace />;
  }

  return <Outlet />;
}
