const BANDS = [
  { stage: 'hypothesis',  label: 'Hypothesis',  color: 'text-gray-400' },
  { stage: 'uncertainty', label: 'Uncertainty', color: 'text-node-hunch' },
  { stage: 'navigation',  label: 'Navigation',  color: 'text-node-assumption-bg' },
  { stage: 'coherence',   label: 'Coherence',   color: 'text-node-learning' },
  { stage: 'holding',     label: 'Holding',     color: 'text-emerald-400' },
] as const;

interface LifecycleBandsProps {
  readonly width: number;
}

export function LifecycleBands({ width }: LifecycleBandsProps) {
  const bandWidth = width / 5;

  return (
    <div className="absolute top-0 left-0 right-0 flex pointer-events-none" style={{ height: 32 }}>
      {BANDS.map((band) => {
        const isHolding = band.stage === 'holding';
        return (
          <div
            key={band.stage}
            className={`flex items-center justify-center border-r border-gray-100 dark:border-gray-800/50 last:border-r-0 ${band.color}`}
            style={{
              width: bandWidth,
              ...(isHolding ? {
                background: 'linear-gradient(90deg, #0a1a10, #0f2518)',
                borderLeft: '2px solid #10b981',
                boxShadow: 'inset 0 0 12px rgba(16,185,129,0.15)',
              } : {}),
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
              {band.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const STAGE_X_POSITIONS: Record<string, number> = {
  hypothesis:  0.1,
  uncertainty: 0.3,
  navigation:  0.5,
  coherence:   0.7,
  holding:     0.9,
};
