import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom } from "@/stores/authAtom";
import { usersApi, type ManagedUser } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight as ChevronNext, Loader2, Search, UserPlus } from "lucide-react";
import type { PaginationMeta } from "@/types";

export default function UsersPage() {
  const { user } = useAtomValue(authAtom);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [role, setRole] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "assessor">("assessor");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    setLoading(true);
    usersApi
      .list({
        page,
        per_page: 20,
        q: qDebounced || undefined,
        role: role === "all" ? undefined : (role as "admin" | "assessor"),
      })
      .then((res) => {
        setUsers(res.data.users);
        setMeta(res.data.meta);
      })
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  }, [page, qDebounced, role]);

  useEffect(() => {
    load();
  }, [load]);

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
      await usersApi.create({ email, password, role: newRole });
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">User Management</h1>
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
          <div className="space-y-1.5">
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
            <Label htmlFor="user-password">Temporary password</Label>
            <PasswordInput
              id="user-password"
              placeholder="Temporary password"
              toggleLabel="temporary password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">The user can change it after first login.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "assessor")}>
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
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </Button>
      </form>

      {/* Search & role filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 w-56"
          />
        </div>
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="assessor">Assessor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User list */}
      <div className="border rounded-lg divide-y">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading users...</div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-destructive">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {q || role !== "all" ? "No users match your filters." : "No users yet."}
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{u.email}</span>
              <span className="border rounded-full px-2 py-0.5 text-xs capitalize">{u.role}</span>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {meta.current_page} of {meta.total_pages} · {meta.total_count} users
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronNext className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
