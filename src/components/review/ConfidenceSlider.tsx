'use client';

const CONFIDENCE_LEVELS = [
  { level: 1, label: 'Gut feel' },
  { level: 2, label: 'Analogy' },
  { level: 3, label: 'Observed' },
  { level: 4, label: 'Early data' },
  { level: 5, label: 'Strong data' },
] as const;

interface ConfidenceSliderProps {
  readonly aiLevel: number;
  readonly humanLevel: number;
  readonly onChange: (level: number) => void;
}

export function ConfidenceSlider({ aiLevel, humanLevel, onChange }: ConfidenceSliderProps) {
  const aiLabel = CONFIDENCE_LEVELS.find(c => c.level === aiLevel)?.label ?? `${aiLevel}`;

  return (
    <div className="bg-gray-900 rounded-lg p-3 border-l-4 border-l-node-option">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500 uppercase tracking-wide">Confidence</div>
        <div className="text-[10px] text-gray-600">
          AI suggested: <span className="text-node-option">{aiLabel}</span>
        </div>
      </div>
      <div className="flex gap-1">
        {CONFIDENCE_LEVELS.map(({ level, label }) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`flex-1 py-2 text-[11px] rounded-md transition-colors ${
              level === humanLevel
                ? 'bg-node-option text-white font-medium'
                : 'bg-gray-800 text-gray-500 hover:bg-gray-750 hover:text-gray-400'
            }`}
            aria-label={`Set confidence: ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
