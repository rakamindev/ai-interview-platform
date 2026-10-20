import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Terminal,
} from "lucide-react";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address (e.g. name@company.com)"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onTouched",
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      const res = await authApi.login({ email: data.email, password: data.password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      toast.success("Welcome back. Authenticated successfully.", "Signed In");
      navigate("/assessments");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string; errors?: Array<{ message?: string }> } } })
          ?.response?.data?.errors?.[0]?.message ||
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Invalid email or password. Please verify your credentials.";
      setServerError(msg);
      toast.error(msg, "Authentication Failed");
    }
  };

  const handleQuickFill = () => {
    setValue("email", "assessor@rakamin.com", { shouldValidate: true });
    setValue("password", "password123", { shouldValidate: true });
    toast.info("Demo credentials applied: assessor@rakamin.com", "Auto-filled");
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#F9F9FB] text-[#1C2024] font-sans selection:bg-[#01959F] selection:text-white">
      {/* Top minimal header */}
      <header className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Rakamin Teal Brand Icon */}
          <div className="h-8 w-8 rounded-lg bg-[#01959F] text-white flex items-center justify-center font-bold text-sm shadow-sm">
            R
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-[#1C2024]">
              Rakamin AI Interview
            </span>
            <span className="text-[10px] font-medium text-[#60646C] tracking-wide uppercase">
              Talent Assessment Platform
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleQuickFill}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-[#60646C] bg-white hover:bg-[#F0F0F3] border border-[#E0E1E6] rounded-md shadow-2xs transition-colors"
        >
          <Terminal className="h-3 w-3 text-[#01959F]" />
          <span>Fill demo credentials</span>
        </button>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-[380px] mx-auto px-4 py-8 space-y-5">
        <div className="space-y-1 text-left">
          <h1 className="text-xl font-bold tracking-tight text-[#1C2024]">
            Sign in
          </h1>
          <p className="text-xs text-[#60646C]">
            Access candidate portfolios, assessor reviews, and vacancy alignment.
          </p>
        </div>

        {/* Rakamin Design System Card */}
        <div className="bg-white border border-[#E0E1E6] shadow-sm rounded-xl p-6 sm:p-7 space-y-4">
          {serverError && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-[#FDBDBE] bg-[#FEEBEC] text-[#CE2C31] text-xs font-medium leading-relaxed"
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Email Field */}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-semibold text-[#1C2024]">
                Email address
              </Label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B8D98] pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={`pl-9 h-9 text-xs sm:text-sm bg-white border-[#E0E1E6] rounded-lg focus-visible:ring-1 focus-visible:ring-[#01959F] focus-visible:border-[#01959F] transition-colors ${
                    errors.email ? "border-[#E5484D] focus-visible:ring-[#E5484D]" : ""
                  }`}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p id="email-error" role="alert" className="text-[11px] font-medium text-[#E5484D] mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1C2024]">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B8D98] pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={`pl-9 pr-9 h-9 text-xs sm:text-sm bg-white border-[#E0E1E6] rounded-lg focus-visible:ring-1 focus-visible:ring-[#01959F] focus-visible:border-[#01959F] transition-colors ${
                    errors.password ? "border-[#E5484D] focus-visible:ring-[#E5484D]" : ""
                  }`}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8B8D98] hover:text-[#1C2024] rounded focus:outline-none focus:ring-1 focus:ring-[#01959F]"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="text-[11px] font-medium text-[#E5484D] mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button in Rakamin Signature Teal */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-9 font-semibold text-xs sm:text-sm bg-[#01959F] hover:bg-[#008995] text-white rounded-lg shadow-xs transition-colors mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Subdued demo helper */}
          <div className="pt-3 border-t border-[#F0F0F3] flex items-center justify-between text-[11px] text-[#60646C]">
            <span>Demo: assessor@rakamin.com</span>
            <button
              type="button"
              onClick={handleQuickFill}
              className="font-medium text-[#01959F] hover:underline"
            >
              Auto-fill
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-[#60646C]">
          Don't have an account?{" "}
          <Link to="/login" onClick={handleQuickFill} className="font-semibold text-[#01959F] hover:underline">
            Sign in with demo
          </Link>
        </p>
      </main>

      {/* Footer bar */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-xs text-[#8B8D98]">
        <p>© Rakamin Academy. Enterprise AI Interview Platform.</p>
      </footer>
    </div>
  );
}
