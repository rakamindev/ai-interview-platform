import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom, saveActiveOrg } from "@/stores/tenantAtom";
import { authAtom, clearToken, saveAuthSession } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  Users,
  LogOut,
  Building2,
  Mail,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const auth = useAtomValue(authAtom);
  const setAuth = useSetAtom(authAtom);
  const setTenant = useSetAtom(tenantAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const [switching, setSwitching] = useState(false);

  // Determine current active role in this tenant
  const activeOrgMembership = auth.organizations?.find((o) => o.id === tenant.id);
  const currentRole = activeOrgMembership?.role || tenant.role || auth.user?.role;
  const isAdmin = currentRole === "admin";

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null, user: null, organizations: [] });
    navigate("/login");
  };

  const handleSwitchTenant = async (targetOrgId: number) => {
    if (targetOrgId === tenant.id) return;
    setSwitching(true);
    try {
      const res = await authApi.switchTenant(targetOrgId);
      const { token, active_organization, role } = res.data;
      saveAuthSession({ token });
      saveActiveOrg({ ...active_organization, role });
      setAuth((prev) => ({ ...prev, token }));
      setTenant({ ...active_organization, role });
      window.location.reload();
    } catch (err) {
      console.error("Gagal berpindah tenant:", err);
    } finally {
      setSwitching(false);
    }
  };

  const hasActiveTenant = Boolean(tenant.id && tenant.name);

  const navItems = [
    { href: "/assessments", label: "Assessments", icon: ClipboardList },
    { href: "/vacancies", label: "Vacancies", icon: Briefcase },
    ...(isAdmin ? [{ href: "/organization/members", label: "Team & Anggota", icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/assessments" className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Rakamin AI Interview</span>
            </Link>
            {hasActiveTenant && (
              <nav className="flex items-center gap-1">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                      location.pathname.startsWith(href)
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            {tenant.name ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 font-normal text-xs"
                    disabled={switching}
                  >
                    {switching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="font-medium max-w-[130px] truncate">{tenant.name}</span>
                    {currentRole && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-semibold">
                        {currentRole}
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Workspace Organisasi
                  </DropdownMenuLabel>
                  {auth.organizations?.map((org) => {
                    const isActive = org.id === tenant.id;
                    return (
                      <DropdownMenuItem
                        key={org.id}
                        onClick={() => handleSwitchTenant(org.id)}
                        className={cn(
                          "flex items-center justify-between text-xs cursor-pointer py-2",
                          isActive && "font-semibold bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{org.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                            {org.role}
                          </Badge>
                          {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate("/signup?tab=org")}
                    className="text-xs text-primary cursor-pointer gap-2 py-1.5"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span>+ Daftarkan Perusahaan Baru</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5 font-medium">
                Tanpa Organisasi
              </span>
            )}

            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {hasActiveTenant ? (
          <Outlet />
        ) : (
          <div className="max-w-xl mx-auto mt-8">
            <Card className="border-dashed border-2">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Belum Terhubung ke Organisasi</CardTitle>
                <CardDescription>
                  Akun Anda {auth.user?.email && <span className="font-semibold text-foreground">({auth.user.email})</span>} terdaftar sebagai akun pribadi mandiri dan belum menjadi anggota dari workspace manapun.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="rounded-lg bg-muted/60 p-4 border text-sm space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" /> Menunggu Undangan Organisasi
                  </h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Mintalah Administrator atau HR di perusahaan Anda untuk mengundang email ini {auth.user?.email && <strong>({auth.user.email})</strong>} melalui menu <em>Team & Anggota</em> pada platform AI Interview. Setelah diundang, Anda dapat berpindah dan mengakses workspace perusahaan.
                  </p>
                </div>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">atau</span>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/60 p-4 border text-sm space-y-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> Daftarkan Perusahaan Baru
                  </h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Jika Anda adalah admin atau recruiter yang ingin membuat workspace organisasi baru untuk perusahaan Anda:
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/signup?tab=org")}
                  >
                    Daftar Workspace Perusahaan Baru
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
