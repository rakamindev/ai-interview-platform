import { useState } from "react";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!current || !next) {
      setError("Both fields are required.");
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({ current_password: current, password: next });
      setSuccess("Password updated. Use your new password the next time you sign in.");
      setCurrent("");
      setNext("");
    } catch (err: any) {
      setError(err?.response?.data?.errors?.[0]?.message ?? "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Change password</h1>
        <p className="text-sm text-muted-foreground">
          Your admin gave you a temporary password — replace it with one you choose.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            toggleLabel="current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            toggleLabel="new password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span>Updating password...</span>
            </>
          ) : (
            <span>Update password</span>
          )}
        </Button>
      </form>
    </div>
  );
}
