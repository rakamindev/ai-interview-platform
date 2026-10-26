import { useAtomValue } from "jotai";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authAtom } from "@/stores/authAtom";

/**
 * ProtectedRoute — guards all assessor/admin pages.
 *
 * How it works:
 * - Reads token from localStorage (via authAtom).
 * - If no token → redirect to /login, passing the original destination
 *   in `location.state.from` so LoginPage can send the user back after
 *   a successful sign-in.
 * - If token present → render child routes normally.
 */
export default function ProtectedRoute() {
  const { token } = useAtomValue(authAtom);
  const location = useLocation();

  if (!token) {
    // Preserve intended destination so LoginPage can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
