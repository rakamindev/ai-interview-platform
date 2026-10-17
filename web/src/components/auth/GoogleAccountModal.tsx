import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, ArrowRight, Loader2, AlertCircle, Info } from "lucide-react";

interface GoogleAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAccount: (email: string) => void;
  loading: boolean;
  error?: string | null;
}

const PRESET_ACCOUNTS = [
  {
    name: "Admin Rakamin",
    email: "admin@rakamin.com",
    role: "Lead Technical Assessor",
    avatarBg: "bg-teal-600",
    initials: "AR",
  },
  {
    name: "Assessor Rakamin",
    email: "assessor@rakamin.com",
    role: "Senior Assessor",
    avatarBg: "bg-blue-600",
    initials: "AS",
  },
  {
    name: "Google Assessor",
    email: "assessor.demo@gmail.com",
    role: "Assessor (Gmail)",
    avatarBg: "bg-amber-600",
    initials: "GA",
  },
];

export const GoogleAccountModal: React.FC<GoogleAccountModalProps> = ({
  open,
  onOpenChange,
  onSelectAccount,
  loading,
  error,
}) => {
  const [customMode, setCustomMode] = useState(false);
  const [customEmail, setCustomEmail] = useState("");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    onSelectAccount(customEmail.trim().toLowerCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-slate-200">
        <div className="p-6 pb-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5 mb-2">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <DialogTitle className="text-base font-bold text-slate-800">
              Sign in with Google
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Pilih akun Google Anda untuk melanjutkan ke <strong>Rakamin AI Interview</strong>
          </DialogDescription>
        </div>

        <div className="p-6 pt-2 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!customMode ? (
            <div className="space-y-2">
              {PRESET_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => onSelectAccount(acc.email)}
                  className="w-full text-left p-3.5 rounded-2xl border border-slate-200/90 hover:border-teal-500 hover:bg-teal-50/40 transition-all flex items-center justify-between group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${acc.avatarBg} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs`}>
                      {acc.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-teal-900">
                        {acc.name}
                      </p>
                      <p className="text-xs text-slate-500">{acc.email}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-teal-700 bg-teal-100/70 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                    {acc.role}
                  </span>
                </button>
              ))}

              <button
                type="button"
                disabled={loading}
                onClick={() => setCustomMode(true)}
                className="w-full text-left p-3.5 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center gap-3 text-slate-600 disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <UserPlus className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Gunakan akun Google lain...
                  </p>
                  <p className="text-xs text-slate-400">
                    Masukkan email organisasi atau Google lainnya
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Email Akun Google:
                </label>
                <Input
                  type="email"
                  placeholder="nama@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  autoFocus
                  required
                  className="h-10 text-sm"
                />
                <p className="text-[11px] text-slate-500">
                  Dapat menggunakan akun Gmail pribadi (@gmail.com) maupun Google Workspace organisasi apa saja.
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomMode(false)}
                  disabled={loading}
                >
                  Kembali ke daftar akun
                </Button>
                <Button
                  type="submit"
                  variant="cta"
                  size="sm"
                  disabled={loading || !customEmail.trim()}
                  className="px-4 font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Verifikasi...
                    </>
                  ) : (
                    <>
                      Lanjutkan <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Dev helper callout */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Info className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <span>Info Integrasi Google OAuth</span>
            </div>
            <p>
              Untuk membuka popup resmi langsung dari <code>accounts.google.com</code>, pasang <code>VITE_GOOGLE_CLIENT_ID</code> di file <code>.env</code>.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
