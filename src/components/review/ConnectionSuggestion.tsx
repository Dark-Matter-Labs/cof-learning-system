'use client';

interface ConnectionSuggestionProps {
  readonly targetTitle: string;
  readonly edgeType: string;
  readonly rationale: string;
  readonly status?: 'accepted' | 'rejected';
  readonly onAccept: () => void;
  readonly onReject: () => void;
}

function formatEdgeType(edgeType: string): string {
  return edgeType.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export function ConnectionSuggestion({
  targetTitle,
  edgeType,
  rationale,
  status,
  onAccept,
  onReject,
}: ConnectionSuggestionProps) {
  return (
    <div className={`bg-gray-900 rounded-lg p-3 ${
      status === 'accepted' ? 'border-l-4 border-l-green-500' :
      status === 'rejected' ? 'border-l-4 border-l-red-500 opacity-50' :
      ''
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-300">
            → <span className="text-gray-400">{formatEdgeType(edgeType)}</span> &quot;{targetTitle}&quot;
          </div>
          <div className="text-xs text-gray-500 mt-1">{rationale}</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onAccept}
            className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
              status === 'accepted' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-green-400'
            }`}
            aria-label={`Accept connection to ${targetTitle}`}
          >
            ✓
          </button>
          <button
            onClick={onReject}
            className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
              status === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-red-400'
            }`}
            aria-label={`Reject connection to ${targetTitle}`}
          >
            ✗
          </button>
        </div>
      </div>
    </div>
  );
}
