const CONFIDENCE_LABELS: Record<number, string> = {
  1: 'Gut feel',
  2: 'Analogy',
  3: 'Observed',
  4: 'Early data',
  5: 'Strong data',
};

interface ConfidenceIndicatorProps {
  readonly level: number | null;
}

export function ConfidenceIndicator({ level }: ConfidenceIndicatorProps) {
  if (level === null) return null;

  const label = CONFIDENCE_LABELS[level] ?? `Level ${level}`;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span
        className="w-2 h-2 rounded-full bg-node-hunch"
        style={{ opacity: 0.4 + (level / 5) * 0.6 }}
      />
      {label}
    </span>
  );
}
