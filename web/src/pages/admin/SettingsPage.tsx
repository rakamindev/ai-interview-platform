import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { usersApi } from "@/services/users";
import { organizationApi } from "@/services/organization";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { useToast } from "@/hooks/useToast";
import { useUser } from "@/hooks/useUser";
import {
  Users,
  Building2,
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";
import type { AuthUser, UserRole, OrganizationInfo } from "@/services/auth";
import { getErrorMessage } from "@/lib/utils";

import type { SkillTaxonomy } from "@/types";

export default function SettingsPage() {
  const { user: currentUser } = useUser();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<"users" | "org" | "taxonomy">("users");

  // Users State
  const [users, setUsers] = useState<(AuthUser & { created_at?: string })[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("assessor");
  const [savingUser, setSavingUser] = useState(false);

  // Org State
  const [org, setOrg] = useState<OrganizationInfo | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgSaving, setOrgSaving] = useState(false);

  // Taxonomy State
  const [taxonomies, setTaxonomies] = useState<SkillTaxonomy[]>([]);
  const [taxSearch, setTaxSearch] = useState("");
  const [taxCategory, setTaxCategory] = useState("all");

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await usersApi.list();
      setUsers(res.data.users);
    } catch {
      // transient
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadOrg = useCallback(async () => {
    try {
      const res = await organizationApi.get();
      setOrg(res.data.organization);
      setOrgName(res.data.organization.name || "");
    } catch {
      // transient
    }
  }, []);

  const loadTaxonomy = useCallback(async () => {
    try {
      const res = await skillTaxonomiesApi.list();
      setTaxonomies(res.data.skill_taxonomies || []);
    } catch {
      // transient
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadOrg();
    loadTaxonomy();
  }, [loadUsers, loadOrg, loadTaxonomy]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      await usersApi.create({
        email: inviteEmail,
        password: invitePassword,
        role: inviteRole,
      });
      success("User added", `Account created for ${inviteEmail}.`);
      setShowInviteModal(false);
      setInviteEmail("");
      setInvitePassword("");
      loadUsers();
    } catch (err: any) {
      toastError("Failed to add user", getErrorMessage(err, "Could not create user."));
    } finally {
      setSavingUser(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    try {
      await usersApi.update(userId, { role: newRole });
      success("Role updated", `User role set to ${newRole.replace("_", " ")}.`);
      loadUsers();
    } catch (err: any) {
      toastError("Failed to update role", getErrorMessage(err, "Please try again."));
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (userId === currentUser?.id) {
      toastError("Cannot delete yourself", "You cannot delete your active admin account.");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    try {
      await usersApi.delete(userId);
      success("User removed", "Account has been deleted.");
      loadUsers();
    } catch (err: any) {
      toastError("Failed to delete user", getErrorMessage(err, "Please try again."));
    }
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSaving(true);
    try {
      const res = await organizationApi.update({ name: orgName });
      setOrg(res.data.organization);
      success("Organization updated", "Tenant settings saved.");
    } catch (err: any) {
      toastError("Failed to save settings", getErrorMessage(err, "Please try again."));
    } finally {
      setOrgSaving(false);
    }
  };

  // Filter taxonomies
  const categories = Array.from(new Set(taxonomies.map((t) => t.category).filter(Boolean)));
  const filteredTaxonomies = taxonomies.filter((t) => {
    const matchSearch =
      !taxSearch ||
      t.skill_label.toLowerCase().includes(taxSearch.toLowerCase()) ||
      t.category.toLowerCase().includes(taxSearch.toLowerCase());
    const matchCategory = taxCategory === "all" || t.category === taxCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Administration"
        description="Manage organization users, access roles, tenant parameters, and competency taxonomies."
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "users"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4 shrink-0" />
          <span>Users &amp; Roles</span>
        </button>

        <button
          onClick={() => setActiveTab("org")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "org"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span>Organization Settings</span>
        </button>

        <button
          onClick={() => setActiveTab("taxonomy")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "taxonomy"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          <span>Skill Taxonomy Explorer</span>
        </button>
      </div>

      {/* Tab 1: Users & Roles */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Organization Members</h3>
              <p className="text-xs text-muted-foreground">
                Assign roles to control interview editing, candidate review, and administration privileges.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowInviteModal(true)} className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-1.5" /> Add Member
            </Button>
          </div>

          {loadingUsers ? (
            <LoadingState rows={4} />
          ) : (
            <Card className="shadow-xs overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                        <th className="py-3 px-4">User Email</th>
                        <th className="py-3 px-4">Access Role</th>
                        <th className="py-3 px-4">Created Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-foreground">{u.email}</div>
                              {isSelf && (
                                <span className="text-[10px] text-primary font-medium">
                                  (Current Session)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Select
                                value={u.role}
                                onValueChange={(val) => handleRoleChange(u.id, val as UserRole)}
                                disabled={isSelf}
                              >
                                <SelectTrigger className="h-8 w-44 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="assessor">Assessor / Recruiter</SelectItem>
                                  <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {!isSelf && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteUser(u.id)}
                                  title="Delete user"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Organization Settings */}
      {activeTab === "org" && (
        <Card className="max-w-xl shadow-xs">
          <CardHeader className="p-4 pb-2 border-b">
            <CardTitle className="text-sm font-semibold">Tenant Organization</CardTitle>
            <CardDescription className="text-xs">
              Manage your company name and tenant environment details.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSaveOrg} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tenant Subdomain / ID</Label>
                <Input
                  value={org?.scheme || "default"}
                  disabled
                  className="bg-muted font-mono text-xs"
                />
              </div>

              <Button type="submit" disabled={orgSaving} size="sm">
                {orgSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save Settings
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Skill Taxonomy Explorer */}
      {activeTab === "taxonomy" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 max-w-sm w-full">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search taxonomy..."
                  value={taxSearch}
                  onChange={(e) => setTaxSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            <Select value={taxCategory} onValueChange={setTaxCategory}>
              <SelectTrigger className="w-48 text-xs h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTaxonomies.map((tax) => (
              <Card key={tax.skill_id} className="p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{tax.skill_label}</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] font-bold">
                    {tax.category}
                  </span>
                </div>
                {tax.scope_include && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Includes:</strong> {tax.scope_include}
                  </p>
                )}
                <div className="space-y-1 pt-1 border-t text-[11px] text-muted-foreground">
                  <div><strong>L1:</strong> {tax.l1_anchor}</div>
                  <div><strong>L3:</strong> {tax.l3_anchor}</div>
                  <div><strong>L5:</strong> {tax.l5_anchor}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Organization Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email Address</Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-password">Initial Password</Label>
              <Input
                id="inv-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Access Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assessor">Assessor / Recruiter</SelectItem>
                  <SelectItem value="hiring_manager">Hiring Manager (Read-only)</SelectItem>
                  <SelectItem value="admin">Organization Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInviteModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingUser}>
                {savingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
