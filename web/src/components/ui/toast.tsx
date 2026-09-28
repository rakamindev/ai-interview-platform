import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "./button";

type Notice = { message: string; kind: "success" | "error"; time: number };
const eventName = "recruitment:notice";
export function notify(message: string, kind: Notice["kind"] = "success") {
  window.dispatchEvent(new CustomEvent<Notice>(eventName, { detail: { message, kind, time: Date.now() } }));
}

/** Mounted above routes so feedback survives a successful save/navigation. */
export function Toaster() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [paused, setPaused] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const receive = (event: Event) => {
      setClosing(false);
      setNotice((event as CustomEvent<Notice>).detail);
    };
    window.addEventListener(eventName, receive);
    return () => window.removeEventListener(eventName, receive);
  }, []);
  useEffect(() => {
    if (!notice || paused || closing) return;
    const timer = window.setTimeout(() => setClosing(true), notice.kind === "error" ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [notice, paused, closing]);
  useEffect(() => {
    if (!closing) return;
    // Fallback also handles environments without animation events.
    const timer = window.setTimeout(() => { setNotice(null); setClosing(false); setPaused(false); }, 240);
    return () => window.clearTimeout(timer);
  }, [closing, notice]);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 left-4 z-[100] sm:left-auto sm:w-96" aria-live="polite" aria-atomic="true">
      {notice && (
        <div data-state={closing ? "closed" : "open"} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
          onTransitionEnd={(event) => { if (closing && event.target === event.currentTarget && event.propertyName === "opacity") { setNotice(null); setClosing(false); setPaused(false); } }}
          className="pointer-events-auto flex translate-y-0 items-start gap-3 rounded-lg border bg-popover p-4 text-sm opacity-100 shadow-md transition-[opacity,transform] duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:pointer-events-none data-[state=closed]:translate-y-2 data-[state=closed]:opacity-0">
          {notice.kind === "error" ? <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
          <p className="flex-1 break-words">{notice.message}</p>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2 h-8 w-8 shrink-0" aria-label="Dismiss notification" disabled={closing} onClick={() => setClosing(true)}><X /></Button>
        </div>
      )}
    </div>
  );
}
