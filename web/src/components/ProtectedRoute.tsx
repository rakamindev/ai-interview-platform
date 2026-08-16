import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom } from "@/stores/authAtom";

const ALLOWED_ROLES = ["admin", "assessor"];

export default function ProtectedRoute() {
  const { token, user } = useAtomValue(authAtom);
  if (!token) return <Navigate to="/login" replace />;
  // A token without an allowed role (e.g. a legacy 'user' token) must not
  // reach assessor pages.
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
