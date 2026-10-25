import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { authAtom } from "@/stores/authAtom";
import { tenantAtom } from "@/stores/tenantAtom";
import { authApi, OrganizationMember } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Trash2,
  Loader2,
  Shield,
  UserCheck,
  Building2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function TeamMembersPage() {
  const auth = useAtomValue(authAtom);
  const tenant = useAtomValue(tenantAtom);

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "assessor">("assessor");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Remove confirmation state
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.getMembers();
      setMembers(res.data.members || []);
    } catch {
      setError("Gagal memuat daftar anggota organisasi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [tenant.id]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteLoading(true);
    try {
      const res = await authApi.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setSuccessMsg(res.data.message || `Berhasil mengundang ${inviteEmail}`);
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteRole("assessor");
      await fetchMembers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string; errors?: Array<{ message?: string }> } } })
          ?.response?.data?.error ||
        (err as { response?: { data?: { errors?: Array<{ message?: string }> } } })
          ?.response?.data?.errors?.[0]?.message ||
        "Gagal mengundang anggota. Pastikan email valid.";
      setInviteError(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (membershipId: number, memberEmail: string) => {
    if (!confirm(`Hapus ${memberEmail} dari organisasi ${tenant.name}?`)) return;

    setRemovingId(membershipId);
    setError(null);
    try {
      await authApi.removeMember(membershipId);
      setSuccessMsg(`Anggota ${memberEmail} berhasil dihapus dari organisasi.`);
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Gagal menghapus anggota dari organisasi.";
      setError(msg);
    } finally {
      setRemovingId(null);
    }
  };

  const currentEmail = auth.user?.email?.toLowerCase();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Team & Anggota</h1>
            {tenant.name && (
              <Badge variant="secondary" className="font-normal text-xs flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {tenant.name}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola anggota tim, asesor wawancara, dan administrator workspace organisasi Anda.
          </p>
        </div>

        {/* Invite button & Dialog */}
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Undang Anggota
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleInviteSubmit}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Undang Anggota ke Workspace
                </DialogTitle>
                <DialogDescription>
                  Undang rekan kerja ke <strong>{tenant.name || "organisasi ini"}</strong>. Mereka akan langsung memiliki akses setelah diundang.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Alamat Email Calon Anggota</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="nama.rekan@perusahaan.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Jika belum memiliki akun AI Interview, akun otomatis disiapkan untuk email ini.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Peran / Hak Akses</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(val) => setInviteRole(val as "admin" | "assessor")}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue placeholder="Pilih Peran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assessor">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-primary" />
                          <span>Assessor (Penilai Wawancara)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-amber-500" />
                          <span>Admin (Pengelola Tim & Penilaian)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inviteError && (
                  <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteOpen(false)}
                  disabled={inviteLoading}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Kirim Undangan
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert banners */}
      {successMsg && (
        <div className="p-3 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-xs font-medium hover:underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Members table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Memuat daftar anggota tim...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-3">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="font-medium text-foreground">Belum ada anggota lain di organisasi ini</p>
            <p className="text-xs max-w-sm mx-auto">
              Gunakan tombol "Undang Anggota" di atas untuk menambahkan kolega atau asesor ke workspace ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
                <tr>
                  <th className="px-6 py-3 font-medium">Anggota / Email</th>
                  <th className="px-6 py-3 font-medium">Peran</th>
                  <th className="px-6 py-3 font-medium">Tanggal Bergabung</th>
                  <th className="px-6 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((member) => {
                  const isSelf = member.email?.toLowerCase() === currentEmail;

                  return (
                    <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs">
                            {member.email?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{member.email}</span>
                            {isSelf && (
                              <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {member.role === "admin" ? (
                          <Badge variant="default" className="gap-1 bg-amber-600 hover:bg-amber-600">
                            <Shield className="h-3 w-3" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <UserCheck className="h-3 w-3" /> Assessor
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                        {(() => {
                          const dateStr = member.joined_at || member.created_at;
                          if (!dateStr) return "-";
                          const parsed = new Date(dateStr);
                          if (isNaN(parsed.getTime())) return "-";
                          return parsed.toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSelf || removingId === member.id}
                          onClick={() => handleRemoveMember(member.id, member.email)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title={isSelf ? "Anda tidak dapat menghapus akun Anda sendiri" : "Hapus dari organisasi"}
                        >
                          {removingId === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
