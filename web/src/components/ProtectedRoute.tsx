import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute() {
  const { token } = useAtomValue(authAtom);
  const setAuth = useSetAtom(authAtom);
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setIsValid(false);
      return;
    }

    authApi.me()
      .then(() => {
        setIsValid(true);
      })
      .catch(() => {
        clearToken();
        setAuth({ token: null });
        setIsValid(false);
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [token, setAuth]);

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
