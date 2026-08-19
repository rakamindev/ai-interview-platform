import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { adminInvitesApi } from "@/services/adminInvites";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import { openGmailCompose, buildAdminInviteEmail } from "@/utils/gmailCompose";
import { toast } from "sonner";
import { Plus, Copy, Check, UserRound, Mail, Search } from "lucide-react";
import type { AdminInvite, PaginationMeta } from "@/types";

function InviteRowActions({ invite }: { invite: AdminInvite }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(invite.invite_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInGmail = () => {
    const { subject, body } = buildAdminInviteEmail({
      role: invite.role,
      expiresAt: invite.expires_at,
      inviteUrl: invite.invite_url,
    });
    openGmailCompose({ to: invite.email, subject, body });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copy}>
        {copied ? <><Check className="h-3 w-3 mr-1" /> Copied</> : <><Copy className="h-3 w-3 mr-1" /> Copy link</>}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={openInGmail}>
        <Mail className="h-3 w-3 mr-1" /> Share on Gmail
      </Button>
    </div>
  );
}

export default function AdminInviteListPage() {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "assessor">("admin");
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<AdminInvite | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = (targetPage = page, q = debouncedSearch) => {
    setLoading(true);
    adminInvitesApi.list(targetPage, q || undefined)
      .then((res) => {
        setInvites(res.data.admin_invites);
        setMeta(res.data.meta);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load(page, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    load(1, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const openDialog = () => {
    setEmail("");
    setRole("admin");
    setShowDialog(true);
  };

  const handleCreate = async () => {
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }
    setCreating(true);
    setShowDialog(false);
    try {
      const res = await adminInvitesApi.create(email.trim(), role);
      setNewInvite(res.data.admin_invite);
      setCopied(false);
      setShowLinkDialog(true);
      toast.success("Invite created");
      load(1, debouncedSearch);
      setPage(1);
    } catch (e: any) {
      toast.error(e?.response?.data?.errors?.[0]?.message ?? "Failed to create invite.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    if (!newInvite) return;
    navigator.clipboard.writeText(newInvite.invite_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInGmail = () => {
    if (!newInvite) return;
    const { subject, body } = buildAdminInviteEmail({
      role: newInvite.role,
      expiresAt: newInvite.expires_at,
      inviteUrl: newInvite.invite_url,
    });
    openGmailCompose({ to: newInvite.email, subject, body });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team</h1>
        <Button size="sm" onClick={openDialog} disabled={creating}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite Admin
        </Button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by email..."
          className="pl-9 h-11 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Invite Admin</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email *</Label>
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "assessor")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="assessor">Assessor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Invite is ready</DialogTitle></DialogHeader>
          {newInvite && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground">
                Share this with <span className="font-medium text-foreground">{newInvite.email}</span>:
              </p>
              <input
                readOnly
                value={newInvite.invite_url}
                onFocus={(e) => e.target.select()}
                className="w-full border rounded-md px-3 py-2 bg-muted/30 text-sm font-mono text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyLink} className="flex-1">
                  {copied ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link</>}
                </Button>
                <Button variant="outline" size="sm" onClick={openInGmail} className="flex-1">
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Share on Gmail
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : invites.length === 0 ? (
        <div className="border rounded-lg p-10 text-center space-y-2">
          <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {debouncedSearch ? `No invites match "${debouncedSearch}".` : "No invites sent yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Card>
            <CardContent className="p-0 divide-y">
              {invites.map((inv) => (
                <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 px-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {inv.role} · invited {formatRelativeTime(inv.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${inv.accepted_at ? "text-green-600" : inv.usable ? "text-amber-600" : "text-destructive"}`}>
                      {inv.accepted_at ? "Accepted" : inv.usable ? "Pending" : "Expired"}
                    </span>
                    {inv.usable && <InviteRowActions invite={inv} />}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {meta && <Pagination meta={meta} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}
