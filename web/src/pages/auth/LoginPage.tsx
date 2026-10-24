import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, CheckCircle2, Lock, Mail, ArrowRight } from "lucide-react";

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
      setError("Email atau kata sandi tidak valid. Silakan periksa kembali.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 font-sans text-slate-100">
      {/* Left panel: Brand Showcase (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-900 to-[#004e54] overflow-hidden border-r border-slate-800/80">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#01959f]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center text-white shadow-lg shadow-teal-500/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white tracking-tight">Rakamin AI</h2>
            <p className="text-xs text-teal-400 font-medium">Autonomous Interview & Assessment</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next-Gen Talent Evaluation</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
            Penilaian Wawancara Berbasis Suara & AI
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Platform asesmen real-time yang mengevaluasi kompetensi kandidat secara objektif dengan transkripsi AI dan analitik performa terukur.
          </p>

          <div className="space-y-3 pt-2">
            {[
              "Transkripsi audio real-time dengan latensi rendah",
              "Analisis kesesuaian fit-gap berbasis rubrik kompetensi",
              "Kepatuhan standar perlindungan privasi data (UU PDP)",
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-[#01959f] shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Rakamin AI Interview Platform. All rights reserved.
        </div>
      </div>

      {/* Right panel: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md space-y-8 bg-slate-900/60 p-8 sm:p-10 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="space-y-2 text-center lg:text-left">
            <div className="lg:hidden inline-flex w-10 h-10 rounded-xl gradient-teal items-center justify-center text-white mb-2 shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Selamat Datang Kembali</h2>
            <p className="text-sm text-slate-400">Masuk ke dashboard assessor & rekrutmen</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Alamat Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="recruiter@rakamin.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#01959f] focus:ring-[#01959f]/20 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Kata Sandi
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#01959f] focus:ring-[#01959f]/20 h-11"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 gradient-teal hover:opacity-95 text-white font-medium shadow-md shadow-teal-500/20 transition-all duration-150"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Masuk ke Portal <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
