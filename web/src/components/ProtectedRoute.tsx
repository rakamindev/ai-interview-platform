import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom } from "@/stores/authAtom";

export default function ProtectedRoute() {
  const { authenticated } = useAtomValue(authAtom);
  if (!authenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
