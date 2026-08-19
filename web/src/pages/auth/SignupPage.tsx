import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveAuthData } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, LayoutDashboard } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.signup({ email, password, role });
      const { token, user } = res.data;
      saveAuthData(token, user);
      setAuth({ token, user });
      navigate("/assessments");
    } catch {
      setError("Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50/70">
      <div className="w-full max-w-[400px] bg-white border rounded-2xl p-6 sm:p-8 shadow-sm sm:shadow-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs mb-1">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Rakamin AI Interview
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Create an account to start your interviews
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-foreground">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Account Role</Label>
            <RadioGroup
              value={role}
              onValueChange={(v) => setRole(v as "admin" | "user")}
              className="flex gap-4 pt-1"
            >
              <div className="flex items-center gap-2 border rounded-lg p-2.5 flex-1 cursor-pointer hover:bg-slate-50 transition-colors">
                <RadioGroupItem value="user" id="role-user" />
                <Label htmlFor="role-user" className="font-medium text-xs cursor-pointer">
                  Candidate (User)
                </Label>
              </div>
              <div className="flex items-center gap-2 border rounded-lg p-2.5 flex-1 cursor-pointer hover:bg-slate-50 transition-colors">
                <RadioGroupItem value="admin" id="role-admin" />
                <Label htmlFor="role-admin" className="font-medium text-xs cursor-pointer">
                  Recruiter (Admin)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-center">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-10 text-sm font-semibold shadow-xs" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sign up
          </Button>
        </form>

        {/* Footer Link */}
        <div className="pt-2 border-t text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary font-semibold hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
