interface ConfidenceIndicatorProps {
  readonly level: number | null;
  readonly max?: number;
  readonly color?: string;
}

export function ConfidenceIndicator({ level, max = 5, color = 'bg-node-hunch' }: ConfidenceIndicatorProps) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full ${
            level !== null && i < level ? color : 'border border-gray-600'
          }`}
        />
      ))}
    </div>
  );
}
