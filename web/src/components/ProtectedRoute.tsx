import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom, authRoleAtom } from "@/stores/authAtom";

const ADMIN_ROLE = "admin";

export default function ProtectedRoute() {
  const { token } = useAtomValue(authAtom);
  const role = useAtomValue(authRoleAtom);

  if (!token) return <Navigate to="/login" replace />;
  if (role !== ADMIN_ROLE) return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}
