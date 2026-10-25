import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveAuthSession } from "@/stores/authAtom";
import { tenantAtom, saveActiveOrg } from "@/stores/tenantAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, User as UserIcon, Loader2 } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "user" ? "user" : "org";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const setAuth = useSetAtom(authAtom);
  const setTenant = useSetAtom(tenantAtom);

  // Form states for Organization signup
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPassword, setOrgPassword] = useState("");

  // Form states for Standalone User signup
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setError(null);
    setSearchParams({ tab: value });
  };

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.signupOrganization({
        organization_name: orgName,
        email: orgEmail,
        password: orgPassword,
      });
      const { token, user, active_organization, organizations } = res.data;
      saveAuthSession({ token, user, organizations });
      saveActiveOrg(active_organization);
      setAuth({ token, user, organizations });
      setTenant(active_organization || { id: null, name: null, scheme: null });
      navigate("/assessments");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            error?: string;
            errors?: Array<{ message?: string; status?: number }>;
            message?: string;
          };
        };
      };

      const status = axiosErr?.response?.status;
      const serverMsg =
        axiosErr?.response?.data?.error ||
        axiosErr?.response?.data?.errors?.[0]?.message ||
        axiosErr?.response?.data?.message;

      if (status && status >= 500) {
        setError("Terjadi kendala pada server saat mendaftarkan organisasi. Silakan coba beberapa saat lagi.");
      } else if (serverMsg && !serverMsg.includes("undefined method") && !serverMsg.includes("backtrace")) {
        setError(serverMsg);
      } else {
        setError("Gagal mendaftarkan organisasi. Silakan periksa kembali data yang dimasukkan.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.signupUser({
        email: userEmail,
        password: userPassword,
      });
      const { token, user, active_organization, organizations } = res.data;
      saveAuthSession({ token, user, organizations });
      saveActiveOrg(active_organization);
      setAuth({ token, user, organizations });
      setTenant(active_organization || { id: null, name: null, scheme: null });
      navigate("/assessments");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            error?: string;
            errors?: Array<{ message?: string; status?: number }>;
            message?: string;
          };
        };
      };

      const status = axiosErr?.response?.status;
      const serverMsg =
        axiosErr?.response?.data?.error ||
        axiosErr?.response?.data?.errors?.[0]?.message ||
        axiosErr?.response?.data?.message;

      if (status && status >= 500) {
        setError("Terjadi kendala pada server saat mendaftarkan akun. Silakan coba beberapa saat lagi.");
      } else if (serverMsg && !serverMsg.includes("undefined method") && !serverMsg.includes("backtrace")) {
        setError(serverMsg);
      } else {
        setError("Gagal mendaftarkan akun pribadi. Silakan periksa kembali data yang dimasukkan.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">AI Interview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pilih jenis pendaftaran sesuai kebutuhan Anda
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="org" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Perusahaan (Admin)</span>
            </TabsTrigger>
            <TabsTrigger value="user" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              <span>Akun Pribadi (User)</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Organization & Admin Signup */}
          <TabsContent value="org" className="mt-4 space-y-4">
            <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Mendaftarkan workspace perusahaan baru. Akun ini otomatis menjadi{" "}
                <span className="font-semibold text-foreground">Admin Organisasi</span> yang memiliki wewenang untuk mengundang anggota tim assessor dan mengelola penilaian.
              </p>

              <form onSubmit={handleOrgSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="org-name">Nama Organisasi / Perusahaan</Label>
                  <Input
                    id="org-name"
                    type="text"
                    placeholder="mis. PT Inovasi Indonesia"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="org-email">Email Administrator</Label>
                  <Input
                    id="org-email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@perusahaan.com"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="org-password">Password</Label>
                  <Input
                    id="org-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimal 6 karakter"
                    value={orgPassword}
                    onChange={(e) => setOrgPassword(e.target.value)}
                    required
                  />
                </div>

                {error && <p className="text-sm text-destructive font-medium">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Daftarkan Organisasi & Akun Admin
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Tab 2: Standalone User Signup */}
          <TabsContent value="user" className="mt-4 space-y-4">
            <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Mendaftar sebagai pengguna individu. Akun Anda dapat diundang ke satu atau lebih organisasi oleh administrator perusahaan terkait.
              </p>

              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="user-email">Email Pribadi</Label>
                  <Input
                    id="user-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@email.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="user-password">Password</Label>
                  <Input
                    id="user-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimal 6 karakter"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    required
                  />
                </div>

                {error && <p className="text-sm text-destructive font-medium">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Daftar Akun Pribadi
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-center text-sm text-muted-foreground">
          Sudah memiliki akun?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Masuk ke akun
          </Link>
        </p>
      </div>
    </div>
  );
}
