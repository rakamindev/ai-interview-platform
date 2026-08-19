import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getAuthState, onAuthChange } from "@/stores/authAtom";

export default function ProtectedRoute() {
  const [auth, setAuth] = useState(getAuthState);

  useEffect(() => {
    return onAuthChange(() => setAuth(getAuthState()));
  }, []);

  if (!auth.accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
