import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillDemo = () => {
    setEmail("admin@rakamin.com");
    setPassword("password");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Dev bypass untuk pengujian lokal
    if (email === "admin@example.com" || email === "admin@rakamin.com" || password === "password") {
      const dummyToken = "demo-bypass-token";
      saveToken(dummyToken);
      setAuth({ token: dummyToken });
      navigate("/assessments");
      setLoading(false);
      return;
    }

    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch {
      setError("Email atau password yang Anda masukkan tidak valid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/70 p-6">
      <div className="w-full max-w-[420px]">
        {/* Card Login Minimalis & Elegan */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm space-y-6">
          <div className="space-y-1.5 text-left">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Sign in to Rakamin
            </h1>
            <p className="text-xs text-slate-500">
              Portal evaluasi talenta dan wawancara berbasis kompetensi.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Masukkan email Anda"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 text-sm border-slate-200 focus-visible:ring-teal-600 focus-visible:border-teal-600 rounded-lg placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Masukkan password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 text-sm border-slate-200 focus-visible:ring-teal-600 focus-visible:border-teal-600 rounded-lg placeholder:text-slate-400"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-sm rounded-lg"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>

          {/* Tombol isi kredensial demo untuk memudahkan asesor */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Akun pengujian:</span>
            <button
              type="button"
              onClick={fillDemo}
              className="font-medium text-teal-600 hover:text-teal-700 hover:underline transition-colors"
            >
              Isi kredensial demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
