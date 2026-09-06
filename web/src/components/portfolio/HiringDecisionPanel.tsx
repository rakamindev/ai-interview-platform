import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, XCircle, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { createHiringDecision, type HiringDecision, type HiringDecisionType } from '@/services/hiringDecisions';
import { parseApiError } from '@/utils/apiError';
import ErrorState from '@/components/ui/ErrorState';

interface Props {
  portfolioId: number;
  existing?: HiringDecision | null;
  onDecisionMade?: (decision: HiringDecision) => void;
}

const DECISION_CONFIG = {
  advance: {
    label: 'Advance',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    activeBg: 'bg-emerald-100 border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  hold: {
    label: 'Hold',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    activeBg: 'bg-amber-100 border-amber-400',
    badge: 'bg-amber-100 text-amber-800',
  },
  reject: {
    label: 'Reject',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200 hover:bg-red-100',
    activeBg: 'bg-red-100 border-red-400',
    badge: 'bg-red-100 text-red-800',
  },
} as const;

export default function HiringDecisionPanel({ portfolioId, existing, onDecisionMade }: Props) {
  const [selected, setSelected] = useState<HiringDecisionType | null>(null);
  const [rationale, setRationale] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReturnType<typeof parseApiError> | null>(null);
  const [committed, setCommitted] = useState<HiringDecision | null>(existing ?? null);

  useEffect(() => {
    if (existing) {
      setCommitted(existing);
    }
  }, [existing]);

  const activeDecision = committed ?? existing ?? null;
  const canSubmit = selected !== null && rationale.trim().length >= 20;

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createHiringDecision(portfolioId, {
        decision: selected,
        rationale: rationale.trim(),
      });
      setCommitted(result);
      onDecisionMade?.(result);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Committed (immutable) state ──────────────────────────────────────────
  if (activeDecision) {
    const config = DECISION_CONFIG[activeDecision.decision];
    const Icon = config.icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="rounded-xl border bg-card p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-muted p-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold">Hiring Decision</h3>
              <Badge className={`text-xs ${config.badge}`}>
                <Icon className={`mr-1 h-3 w-3 ${config.color}`} />
                {config.label}
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(activeDecision.decided_at).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {activeDecision.rationale}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground/60 flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" />
              This decision is permanent and cannot be changed (audit trail).
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Decision form ────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-xl border bg-card p-5 shadow-sm"
    >
      <h3 className="text-sm font-semibold mb-1">Hiring Decision</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Decisions are permanent and cannot be changed once confirmed. Please ensure you have reviewed the candidate portfolio thoroughly.
      </p>

      {/* Decision buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(Object.keys(DECISION_CONFIG) as HiringDecisionType[]).map((key) => {
          const config = DECISION_CONFIG[key];
          const Icon = config.icon;
          const isActive = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-all duration-150
                ${isActive ? config.activeBg : config.bg}`}
            >
              <Icon className={`h-5 w-5 ${config.color}`} />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Rationale textarea — animates in when decision selected */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="rationale"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Decision rationale <span className="text-destructive">*</span>
                <span className="ml-1 text-muted-foreground/60">
                  (min. 20 characters, currently {rationale.trim().length})
                </span>
              </label>
              <Textarea
                placeholder="Explain why this candidate is being advanced, held, or rejected based on the assessment results..."
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                className="resize-none h-28 text-sm"
                maxLength={2000}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <ErrorState error={error} className="py-4" />}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="w-full"
      >
        {loading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
        ) : (
          'Confirm Decision (Permanent)'
        )}
      </Button>
    </motion.div>
  );
}
