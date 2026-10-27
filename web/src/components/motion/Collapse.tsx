import type { ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";

/** Expands/collapses content in place, so the page below slides instead of jumping. */
export function Collapse({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.div
          key="collapse"
          className={className}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
