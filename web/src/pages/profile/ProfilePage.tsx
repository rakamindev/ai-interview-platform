import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { authAtom, clearToken } from "@/stores/authAtom";
import { tenantAtom } from "@/stores/tenantAtom";
import { authApi } from "@/services/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, ShieldCheck, Building2, User } from "lucide-react";

export default function ProfilePage() {
  const [auth, setAuth] = useAtom(authAtom);
  const [tenant, setTenant] = useAtom(tenantAtom);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Refresh current user and tenant context from backend API
    authApi
      .getMe()
      .then((res) => {
        if (res.data?.user) {
          setAuth((prev) => ({ ...prev, user: res.data.user }));
        }
        if (res.data?.tenant) {
          setTenant({
            id: res.data.tenant.id,
            name: res.data.tenant.name,
          });
        }
      })
      .catch(() => {
        // Fallback to local state if offline or token-only
      })
      .finally(() => setLoading(false));
  }, [setAuth, setTenant]);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null, user: null });
    navigate("/login");
  };

  const user = auth.user;
  const userEmail = user?.email || "admin@example.com";
  const userRole = user?.role || "admin";

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account credentials, security permissions, and multi-tenant workspace context.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Account Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Account Details</CardTitle>
                <CardDescription>
                  Your authenticated assessor credentials and access privileges.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Email Address</Label>
                <div className="text-sm font-medium mt-1">{userEmail}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Role</Label>
                <div className="mt-1">
                  <Badge variant="secondary" className="capitalize text-xs font-semibold">
                    {userRole}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Profile Card (Moved from Settings) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Tenant Profile</CardTitle>
                <CardDescription>
                  Multi-tenant workspace identifiers used for role-based scoping and audit logging.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Organization Name</Label>
                <div className="text-sm font-medium mt-1">{tenant.name || "Test Corp"}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tenant Identifier</Label>
                <div className="text-sm font-mono mt-1">{tenant.id || "test-corp"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Actions Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Session Security</CardTitle>
                <CardDescription>
                  Authentication token lifecycle and data privacy policy enforcement.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground leading-relaxed">
              Your session is protected by cryptographic JWT credentials scoped to this tenant workspace. In accordance with UU PDP No. 27/2022 standards, candidate evaluation records are protected with tenant-level access boundaries.
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out of Platform
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
