import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom } from "@/stores/authAtom";

interface ProtectedRouteProps {
    /**
     * When set, only these roles may enter. Everyone else (e.g. a candidate
     * token on an assessor route) is sent to the candidate home instead of
     * hitting the API and bouncing back to /login.
     */
    roles?: string[];
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
    const { token, role } = useAtomValue(authAtom);
    if (!token) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(role ?? "")) return <Navigate to="/candidate" replace />;
    return <Outlet />;
}
