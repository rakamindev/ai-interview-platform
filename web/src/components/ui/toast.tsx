import { useSyncExternalStore } from "react";

type Toast = { id: number; message: string };
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function toast(message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4000);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="animate-toast rounded-md border border-destructive/40 bg-destructive px-4 py-3 text-sm text-destructive-foreground shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
