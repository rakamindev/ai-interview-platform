import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// Heights of the five level bars, L1 to L5: the rubric's levels, drawn like the interview's voice meter.
const LEVEL_HEIGHTS = [20, 32, 44, 58, 72];

function LevelBars() {
  return (
    <div aria-hidden="true" className="flex items-end gap-1.5">
      {LEVEL_HEIGHTS.map((height, i) => (
        <div key={height} className="flex flex-col items-center gap-1.5">
          <div
            className={cn(
              "w-2.5 origin-bottom rounded-full motion-safe:animate-level-breathe",
              i === LEVEL_HEIGHTS.length - 1 ? "bg-secondary" : "bg-white",
            )}
            style={{
              height,
              opacity: i === LEVEL_HEIGHTS.length - 1 ? 1 : 0.35 + i * 0.15,
              animationDelay: `${i * 0.3}s`,
            }}
          />
          <span className="text-[10px] font-medium tracking-wide text-white/60">L{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Phone: a deep-teal header and the form on a sheet over it. From md up: the two side by side in one card.
    <div className="min-h-screen bg-[hsl(var(--primary-deep))] md:flex md:items-center md:justify-center md:bg-muted md:p-6">
      <div className="flex min-h-screen flex-col md:min-h-0 md:w-full md:max-w-3xl md:flex-row md:overflow-hidden md:rounded-2xl md:shadow-xl">
        <header className="bg-[hsl(var(--primary-deep))] px-6 pb-14 pt-[max(3rem,env(safe-area-inset-top))] text-white md:flex md:w-1/2 md:flex-col md:justify-between md:p-10">
          <LevelBars />
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">For assessors</p>
            <h1 className="mt-2 text-[2rem] font-extrabold leading-tight tracking-tight">AI Interview</h1>
            <p className="mt-3 max-w-[18rem] text-[15px] leading-relaxed text-white/80">
              Voice interviews, rated skill by skill.
            </p>
          </div>
        </header>

        <main className="-mt-6 flex-1 rounded-t-3xl bg-background px-6 pb-10 pt-8 md:mt-0 md:flex md:w-1/2 md:flex-col md:justify-center md:rounded-none md:p-10">
          <h2 className="text-xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use the email your company set up for you.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl text-base"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl pr-12 text-base"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="mt-8 border-t pt-5 text-sm text-muted-foreground">
            Here for an interview? Open the link in your invitation. Candidates don't need an account.
          </p>
        </main>
      </div>
    </div>
  );
}
