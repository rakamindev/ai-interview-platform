// web/src/components/portfolio/SkillLevelBadge.tsx
// Semantic colors: L1=grey(fundamental), L2=blue(basic), L3=green(proficient),
//                  L4=purple(advanced), L5=gold(expert)

const LEVEL_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: 'L1 · Fundamental', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  2: { label: 'L2 · Basic',       className: 'bg-blue-50 text-blue-700 border-blue-200' },
  3: { label: 'L3 · Proficient',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  4: { label: 'L4 · Advanced',    className: 'bg-purple-50 text-purple-700 border-purple-200' },
  5: { label: 'L5 · Expert',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

interface Props {
  level: number;
  size?: 'sm' | 'md';
}

export default function SkillLevelBadge({ level, size = 'sm' }: Props) {
  const config = LEVEL_CONFIG[level] ?? {
    label: `L${level}`,
    className: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 font-mono font-semibold
        ${size === 'sm' ? 'py-0.5 text-[10px]' : 'py-1 text-xs'}
        ${config.className}`}
    >
      {config.label}
    </span>
  );
}
