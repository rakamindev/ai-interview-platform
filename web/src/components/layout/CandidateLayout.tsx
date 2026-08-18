import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { ShieldCheck, Lock, AlertTriangle, EyeOff } from "lucide-react";

export default function CandidateLayout() {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);

  useEffect(() => {
    // 1. Prevent Right Click Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showWarning("Right-clicking is disabled during the assessment.");
    };

    // 2. Prevent Copy & Cut
    const handleCopyCut = (e: ClipboardEvent) => {
      e.preventDefault();
      showWarning("Copying text is disabled to maintain assessment integrity.");
    };

    // 3. Prevent Security Key Combinations (PrtScn, F12, Ctrl+C, Cmd+C, Win+Shift+S Snipping Tool)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      
      if (
        e.key === "F12" ||
        e.key === "PrintScreen" ||
        (isCmdOrCtrl && (e.key === "c" || e.key === "C" || e.key === "u" || e.key === "U" || e.key === "s" || e.key === "S" || e.key === "i" || e.key === "I")) ||
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5"))
      ) {
        e.preventDefault();
        showWarning("Screenshots and Developer Tools are restricted during the interview.");
      }
    };

    // 4. Windows Snipping Tool / App Switch Blur Defense
    const handleBlur = () => {
      setIsWindowBlurred(true);
    };

    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    let timer: ReturnType<typeof setTimeout>;
    const showWarning = (msg: string) => {
      setWarningMessage(msg);
      clearTimeout(timer);
      timer = setTimeout(() => setWarningMessage(null), 3000);
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopyCut);
    window.addEventListener("cut", handleCopyCut);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopyCut);
      window.removeEventListener("cut", handleCopyCut);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 select-none selection:bg-none relative overflow-x-hidden font-sans">
      {/* CSS Rule to block browser printing & enforce selection lock */}
      <style>{`
        @media print {
          body { display: none !important; }
        }
        .select-none {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
      `}</style>

      {/* Screen Blur Overlay when Snipping Tool or Tab Switch is Active (Windows & Mac Defense) */}
      {isWindowBlurred && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center space-y-3 border-4 border-amber-500/40 animate-fade-in">
          <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/30">
            <EyeOff className="h-10 w-10 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-white">Assessment Content Protected</h2>
          <p className="text-xs text-slate-400 max-w-sm">
            Screen is hidden because the browser lost focus or a screenshot tool (Snipping Tool) was activated.
            <br />
            <span className="text-teal-400 font-medium">Click back into this window to resume your interview.</span>
          </p>
        </div>
      )}

      {/* Floating Anti-Cheat Toast Warning */}
      {warningMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-amber-500/90 text-slate-950 px-4 py-2 rounded-xl font-semibold text-xs shadow-2xl flex items-center gap-2 backdrop-blur-md border border-amber-300 animate-bounce">
          <AlertTriangle className="h-4 w-4 shrink-0 text-slate-950" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Candidate Header Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800/80 shadow-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white shadow-xs">
              <img
                src="/rakamin-logo.png"
                alt="Rakamin Logo"
                className="h-5 object-contain"
              />
            </div>
            <span className="text-xs font-bold text-slate-300 tracking-wide uppercase font-mono">
              AI Interview Assessment
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
              Proctored &amp; Protected Session
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Lock className="h-3 w-3" /> Anti-Copy Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Candidate Content */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Security Footer */}
      <footer className="border-t border-slate-900/80 py-3 text-center text-[11px] text-slate-500">
        Rakamin AI Interview Platform · Encrypted &amp; UU PDP Compliant Session
      </footer>
    </div>
  );
}
