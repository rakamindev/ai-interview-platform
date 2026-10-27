import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";

const loadFeatures = () => import("@/lib/motionFeatures").then((mod) => mod.default);

/** Motion engine loads lazily after first paint; users with "reduce motion" get instant transitions. */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
