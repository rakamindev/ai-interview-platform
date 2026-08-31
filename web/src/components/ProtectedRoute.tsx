import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom } from "@/stores/authAtom";
import useUserRole from "@/hooks/useUserRole";

export default function ProtectedRoute() {
  const { token } = useAtomValue(authAtom);
  const { isUser } = useUserRole();
  if (!token) return <Navigate to="/login" replace />;
  if (isUser) return <Navigate to="/interview" replace />;
  return <Outlet />;
}
