import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { adminUsersApi } from "@/services/adminUsers";
import { AdminOrganization } from "@/services/adminOrganizations";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
  organizations: AdminOrganization[];
}

export default function CreateUserModal({
  open,
  onOpenChange,
  onUserCreated,
  organizations,
}: CreateUserModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "assessor">("admin");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setRole("admin");
    setOrganizationId("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role === "assessor" && !organizationId) {
      setError("Please select an organization for the tenant assessor.");
      return;
    }

    setLoading(true);
    try {
      await adminUsersApi.create({
        email: email.trim(),
        password,
        role,
        organization_id: role === "assessor" ? Number(organizationId) : undefined,
      });
      resetForm();
      onUserCreated();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || "Failed to create user. Please check your inputs.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Provision New User
          </DialogTitle>
          <DialogDescription>
            Create an operator account. Super Admins operate across all tenants; Assessors are scoped to a specific client organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20" role="alert">
              {error}
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">User Role</Label>
            <RadioGroup
              value={role}
              onValueChange={(val) => setRole(val as "admin" | "assessor")}
              className="grid grid-cols-2 gap-3"
            >
              <div
                onClick={() => setRole("admin")}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  role === "admin"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <RadioGroupItem value="admin" id="role-admin" className="mt-1" />
                <div>
                  <Label htmlFor="role-admin" className="font-semibold cursor-pointer flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Super Admin
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rakamin operator. Full platform and multi-tenant access.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setRole("assessor")}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  role === "assessor"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <RadioGroupItem value="assessor" id="role-assessor" className="mt-1" />
                <div>
                  <Label htmlFor="role-assessor" className="font-semibold cursor-pointer flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4" /> Tenant Admin
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Client assessor / recruiter bound strictly to an organization.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email Address</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="e.g. admin@rakamin.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="user-password">Initial Password</Label>
            <Input
              id="user-password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {/* Organization Select (only for assessor) */}
          {role === "assessor" && (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="user-org">Client Organization</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger id="user-org" className="w-full">
                  <SelectValue placeholder="Select client organization..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name} ({org.scheme})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {organizations.length === 0 && (
                <p className="text-xs text-amber-600">
                  No organizations found. Please create an organization first.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
