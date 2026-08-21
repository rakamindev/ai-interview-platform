import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getAuthState, onAuthChange } from "@/stores/authAtom";

interface ProtectedRouteProps {
  isAuthReady: boolean;
}

export default function ProtectedRoute({ isAuthReady }: ProtectedRouteProps) {
  const [auth, setAuth] = useState(getAuthState);

  useEffect(() => {
    return onAuthChange(() => setAuth(getAuthState()));
  }, []);

  if (!isAuthReady) return null;
  if (!auth.accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
