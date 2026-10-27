import type { ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";

/** Fades a message in when it appears (errors, warnings, confirmations) so the change is noticed. */
export function Notice({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.div key="notice" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
