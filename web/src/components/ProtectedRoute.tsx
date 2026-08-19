import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom } from "@/stores/authAtom";

export default function ProtectedRoute() {
  const { accessToken } = useAtomValue(authAtom);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
