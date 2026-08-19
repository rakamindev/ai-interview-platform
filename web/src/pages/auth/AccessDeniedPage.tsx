import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import AuthShell from "@/components/layout/AuthShell";

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);

  const handleSignOut = () => {
    clearToken();
    setAuth({ token: null });
    void navigate("/login", { replace: true });
  };

  return (
    <AuthShell
      title="No assessor access"
      subtitle="This account can't open the assessor workspace."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Assessor tools are available to admin accounts. If you believe this is a mistake, contact
          your assessor or administrator.
        </p>
        <Button type="button" className="w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </AuthShell>
  );
}
