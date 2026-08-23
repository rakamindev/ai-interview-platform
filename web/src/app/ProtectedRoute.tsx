import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom } from "@/features/auth/stores/authAtom";

export default function ProtectedRoute() {
  const { token } = useAtomValue(authAtom);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}
