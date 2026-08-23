import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Copy, Check } from "lucide-react";
import { m } from "@/(paraglide)/messages.js";
import { authApi } from "@/services/auth";

const InviteFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "assessor"])
});

type InviteFormValues = z.infer<typeof InviteFormSchema>;

export default function InviteAdminPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<InviteFormValues>({
    resolver: zodResolver(InviteFormSchema),
    defaultValues: { email: "", role: "assessor" }
  });

  const onSubmit = async (data: InviteFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi.createInvite(data);
      setInviteUrl(res.data.invite_url);
    } catch {
      setError(m.admin.failed_to_create());
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground" aria-label="Back to assessments">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Admin</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{m.admin.invite_title()}</span>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{m.admin.invite_subtitle()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {m.admin.generate_invite()}.
          </p>
        </div>

        {inviteUrl ? (
          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="font-medium">{m.admin.invite_generated()}</h2>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteUrl} className="flex-1 font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Copy invite link">
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {m.admin.share_link()}.
            </p>
            <Button variant="outline" onClick={() => setInviteUrl(null)}>
              {m.admin.invite_another()}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">
                {m.admin.email()} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>{m.admin.role()}</Label>
              <Select
                defaultValue="assessor"
                onValueChange={(v) => setValue("role", v as "admin" | "assessor")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assessor">{m.admin.assessor()}</SelectItem>
                  <SelectItem value="admin">{m.admin.admin()}</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => history.back()}>
                {m.admin.cancel()}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {m.admin.generate_link()}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
