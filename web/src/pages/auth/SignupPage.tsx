import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
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
      const { token } = res.data;
      saveToken(token);
      setAuth({ token });

      navigate("/assessments");
    } catch {
      setError("Signup failed. Please check your inputs and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg tracking-tight">Rakamin AI Interview</span>
        </div>

        <div className="w-full max-w-sm mx-auto space-y-6 my-auto py-12">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
            <p className="text-sm text-muted-foreground">
              Get started by filling out your information below
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>I want to join as</Label>
              <RadioGroup
                value={role}
                onValueChange={(v) => setRole(v as "admin" | "user")}
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="user" id="role-user" />
                  <Label htmlFor="role-user" className="font-normal cursor-pointer text-sm">
                    Candidate
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="admin" id="role-admin" />
                  <Label htmlFor="role-admin" className="font-normal cursor-pointer text-sm">
                    Assessor
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

      </div>

      <div className="hidden lg:block bg-primary" />
    </div>
  );
}
