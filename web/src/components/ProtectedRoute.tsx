import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom } from "@/stores/authAtom";
import { isFitGapDemoEnabled } from "@/lib/demoMode";

export default function ProtectedRoute() {
  const { token } = useAtomValue(authAtom);
  if (!token && !isFitGapDemoEnabled()) return <Navigate to="/login" replace />;
  return <Outlet />;
}
