'use client';

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5Chat({ onNext, onBack }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Chat mode coming soon...</p>
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm text-gray-400">← Back</button>
        <button onClick={onNext} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">Skip →</button>
      </div>
    </div>
  );
}
