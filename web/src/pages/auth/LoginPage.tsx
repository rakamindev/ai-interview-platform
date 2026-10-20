import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PasswordInput from "@/components/auth/PasswordInput";
import { loginSchema } from "@/schemas/auth";
import { Label } from "@/components/ui/label";
import { ArrowRight, LayoutDashboard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { showRequestError } from "@/lib/requestToast";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch (error) {
      showRequestError(error, "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 sm:px-6 lg:flex lg:items-center lg:justify-center lg:py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-primary/15 bg-background shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden bg-gradient-to-br from-primary/15 via-background to-secondary/15 p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LayoutDashboard className="h-6 w-6" /></span>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Rakamin workspace</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">Review the signal behind every interview.</h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">A calmer workspace for assessment design, live monitoring, and evidence-based hiring review.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Secure assessor access</div>
        </div>

        <Card className="rounded-none border-0 shadow-none">
          <CardContent className="p-6 sm:p-10">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary"><LayoutDashboard className="mr-1.5 h-3 w-3" />AI Interview</Badge>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your assessor workspace.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="you@example.com" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><span className="text-xs text-muted-foreground">Assessor account</span></div>
                <PasswordInput id="password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Sign in<ArrowRight className="h-4 w-4" /></Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
