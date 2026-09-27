import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldCheck,
  UserCheck,
  Building2,
  UserPlus,
  Building,
  Loader2,
  Users,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { adminUsersApi, AdminUser } from "@/services/adminUsers";
import { adminOrganizationsApi, AdminOrganization } from "@/services/adminOrganizations";
import CreateUserModal from "./CreateUserModal";
import CreateOrganizationModal from "./CreateOrganizationModal";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("users");
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, orgsRes] = await Promise.all([
        adminUsersApi.list(),
        adminOrganizationsApi.list(),
      ]);
      setUsers(usersRes.data.users || []);
      setOrganizations(orgsRes.data.organizations || []);
    } catch (err: any) {
      setError("Failed to load admin data. Ensure you are signed in with a Super Admin account.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.organization_name && u.organization_name.toLowerCase().includes(userSearch.toLowerCase()));
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, roleFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Platform Administration</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
              Super Admin Only
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Provision client organizations (tenants), manage Super Admins, and assign Tenant Assessors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="flex items-center gap-1.5"
            onClick={() => setCreateOrgOpen(true)}
          >
            <Building className="h-4 w-4" />
            New Organization
          </Button>
          <Button
            className="flex items-center gap-1.5"
            onClick={() => setCreateUserOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            New User
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-lg border border-destructive/20 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organizations ({organizations.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search email or organization..."
                className="pl-9"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <span className="text-xs text-muted-foreground mr-1">Role:</span>
              <Button
                variant={roleFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setRoleFilter("all")}
              >
                All ({users.length})
              </Button>
              <Button
                variant={roleFilter === "admin" ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setRoleFilter("admin")}
              >
                Super Admins ({users.filter((u) => u.role === "admin").length})
              </Button>
              <Button
                variant={roleFilter === "assessor" ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setRoleFilter("assessor")}
              >
                Assessors ({users.filter((u) => u.role === "assessor").length})
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading user records...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center p-12 space-y-3">
                  <p className="text-muted-foreground">No users match your criteria.</p>
                  <Button variant="outline" size="sm" onClick={() => setCreateUserOpen(true)}>
                    Provision First User
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold">User</th>
                        <th className="px-6 py-3 font-semibold">Role</th>
                        <th className="px-6 py-3 font-semibold">Organization Binding</th>
                        <th className="px-6 py-3 font-semibold">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-medium">
                            <div className="flex items-center gap-2">
                              {u.role === "admin" ? (
                                <ShieldCheck className="h-4 w-4 text-purple-600 shrink-0" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-blue-600 shrink-0" />
                              )}
                              <span>{u.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {u.role === "admin" ? (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100">
                                Super Admin
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                                Tenant Assessor
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {u.organization_name ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{u.organization_name}</span>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {u.organization_scheme}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Global / Cross-Tenant</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Organizations Tab ── */}
        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Registered Client Tenants</CardTitle>
                <CardDescription>
                  Enterprise organizations with isolated assessment databases and tenant schemes.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5"
                onClick={() => setCreateOrgOpen(true)}
              >
                <Building className="h-4 w-4" />
                Add Tenant
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading organization records...
                </div>
              ) : organizations.length === 0 ? (
                <div className="text-center p-12 space-y-3">
                  <p className="text-muted-foreground">No organizations registered yet.</p>
                  <Button variant="outline" size="sm" onClick={() => setCreateOrgOpen(true)}>
                    Create First Organization
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Organization Name</th>
                        <th className="px-6 py-3 font-semibold">Tenant Scheme</th>
                        <th className="px-6 py-3 font-semibold">Identifier</th>
                        <th className="px-6 py-3 font-semibold">Host / Domain</th>
                        <th className="px-6 py-3 font-semibold">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {organizations.map((org) => (
                        <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-semibold flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary shrink-0" />
                            {org.name}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="font-mono bg-muted/30 text-xs">
                              {org.scheme}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 font-mono text-muted-foreground text-xs">
                            {org.identifier}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-xs">
                            {org.host || "—"}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(org.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateUserModal
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onUserCreated={fetchData}
        organizations={organizations}
      />

      <CreateOrganizationModal
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        onOrgCreated={fetchData}
      />
    </div>
  );
}
