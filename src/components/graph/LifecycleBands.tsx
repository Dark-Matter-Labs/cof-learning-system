const BANDS = [
  { stage: 'divergence', label: 'Divergence', color: 'text-gray-400' },
  { stage: 'attractor', label: 'Attractor', color: 'text-node-hunch' },
  { stage: 'convergence', label: 'Convergence', color: 'text-node-assumption-bg' },
  { stage: 'execution', label: 'Execution', color: 'text-node-commitment' },
] as const;

interface LifecycleBandsProps {
  readonly width: number;
}

export function LifecycleBands({ width }: LifecycleBandsProps) {
  const bandWidth = width / 4;

  return (
    <div className="absolute top-0 left-0 right-0 flex pointer-events-none" style={{ height: 32 }}>
      {BANDS.map((band, i) => (
        <div
          key={band.stage}
          className={`flex items-center justify-center border-r border-gray-100 dark:border-gray-800/50 last:border-r-0 ${band.color}`}
          style={{ width: bandWidth, left: bandWidth * i }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
            {band.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export const STAGE_X_POSITIONS: Record<string, number> = {
  divergence: 0.125,
  attractor: 0.375,
  convergence: 0.625,
  execution: 0.875,
};
