// web/src/components/portfolio/NotAssessedSkillCard.tsx
import { motion, type Variants } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  skillLabel: string;
  customVariants?: Variants;
}

export default function NotAssessedSkillCard({ skillLabel, customVariants }: Props) {
  const reducedMotion = useReducedMotion();

  const variants: Variants = customVariants ?? {
    hidden:  reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const } },
  };

  return (
    <motion.div
      variants={variants}
      className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 p-4"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0 rounded-full bg-muted p-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{skillLabel}</span>
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold
                         uppercase tracking-wider text-muted-foreground/50"
            >
              Tidak Dinilai
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground/50">
            Skill ini tidak mendapat cukup pertanyaan probe selama sesi.
            Tidak ada rating yang dapat diberikan secara jujur.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
