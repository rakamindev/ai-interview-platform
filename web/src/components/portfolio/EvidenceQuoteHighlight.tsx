// web/src/components/portfolio/EvidenceQuoteHighlight.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, ChevronDown } from 'lucide-react';

interface Props {
  quotes: string[];
  maxVisible?: number;
}

export default function EvidenceQuoteHighlight({ quotes, maxVisible = 1 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? quotes : quotes.slice(0, maxVisible);
  const hasMore = quotes.length > maxVisible;

  if (quotes.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-1.5">
      {visible.map((quote, i) => (
        <div key={i} className="flex gap-2 rounded-md bg-muted/40 px-3 py-2">
          <Quote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40 rotate-180" />
          <p className="text-[11px] leading-relaxed text-muted-foreground italic">{quote}</p>
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={expanded ? 'less' : 'more'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {expanded ? 'Sembunyikan' : `+${quotes.length - maxVisible} kutipan lagi`}
            </motion.span>
          </AnimatePresence>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3 w-3" />
          </motion.div>
        </button>
      )}
    </div>
  );
}
