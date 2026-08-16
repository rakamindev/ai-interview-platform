import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom } from "@/stores/authAtom";
import { usersApi, type ManagedUser } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";

export default function UsersPage() {
  const { user } = useAtomValue(authAtom);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "assessor">("assessor");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    usersApi
      .list()
      .then((res) => setUsers(res.data.users))
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Admin-only page — defensive even though the route is admin-gated.
  if (user?.role !== "admin") {
    return <Navigate to="/assessments" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    if (!email || !password) {
      setCreateError("Email and password are required.");
      return;
    }
    setCreating(true);
    try {
      await usersApi.create({ email, password, role });
      setCreateSuccess(`Account created for ${email}.`);
      setEmail("");
      setPassword("");
      load();
    } catch (err: any) {
      setCreateError(err?.response?.data?.errors?.[0]?.message ?? "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">
          Registration is invite-based: only admins can create accounts.
        </p>
      </div>

      {/* Create account */}
      <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Create account</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="assessor@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-password">Password</Label>
            <Input
              id="user-password"
              type="text"
              placeholder="Temporary password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "assessor")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assessor">Assessor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {createError && <p className="text-xs text-destructive">{createError}</p>}
        {createSuccess && <p className="text-xs text-green-600">{createSuccess}</p>}

        <Button type="submit" disabled={creating}>
          {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create account
        </Button>
      </form>

      {/* User list */}
      <div className="border rounded-lg divide-y">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading users...</div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-destructive">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No users yet.</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{u.email}</span>
              <span className="border rounded-full px-2 py-0.5 text-xs capitalize">{u.role}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
