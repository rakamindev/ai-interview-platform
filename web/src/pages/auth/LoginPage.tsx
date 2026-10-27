import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Sparkles, ShieldCheck, CheckCircle2, ArrowRight, Zap } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError("Email atau kata sandi tidak sesuai. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setEmail("admin@rakamin.com");
    setPassword("password123");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-teal-50/70 via-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Left Side: Brand Story & Enterprise Highlights */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <BrandLogo size="lg" />
            <div className="space-y-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-400/15 text-teal-300 border border-teal-400/20">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Enterprise Edition
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Next-Gen AI Interview &amp; Skill Verification
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Platform wawancara suara real-time berbasis AI adaptif dengan analisis Fit/Gap radar chart instan dan kepatuhan UU PDP.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-700/60">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-200">
                  <strong className="text-white">Autonomous Voice Live:</strong> Dialog adaptif tanpa naskah kaku.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-200">
                  <strong className="text-white">Fit/Gap Radar Chart:</strong> Visualisasi kesenjangan kompetensi kandidat secara terukur.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-200">
                  <strong className="text-white">UU PDP Compliant:</strong> Perlindungan data pribadi dan enkripsi end-to-end.
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800">
            <span>Powered by Gemini 3.8 Enterprise</span>
            <span>v2.4.0</span>
          </div>
        </div>

        {/* Right Side: Sign In Form */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Masuk ke Portal Assessor
              </h1>
              <p className="text-sm text-slate-500">
                Akses dashboard manajemen penilaian, lowongan, dan laporan kandidat.
              </p>
            </div>

            {/* Quick Demo Fill Shortcut */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <Zap className="h-3.5 w-3.5 text-amber-600 fill-amber-500" /> Demo Evaluation Account
                </div>
                <div className="text-[11px] text-amber-700 font-mono">
                  admin@rakamin.com • password123
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-white hover:bg-amber-100 border-amber-300 text-amber-900 text-xs font-medium shrink-0 h-8 shadow-2xs"
                onClick={fillDemoAccount}
              >
                Auto-Fill
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Alamat Email Kerja
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@perusahaan.com"
                  className="rounded-xl border-slate-200 focus-visible:ring-teal-600 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                    Kata Sandi
                  </Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="rounded-xl border-slate-200 focus-visible:ring-teal-600 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memverifikasi...
                  </>
                ) : (
                  <>
                    Masuk ke Workspace <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </form>

            <div className="pt-2 text-center">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> Akses terproteksi JWT &amp; Multi-Tenant Isolation
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
