'use client';

export type GraphView = 'force' | 'tree' | 'timeline' | 'workflow';

interface NodeTypeOption {
  readonly id: string;
  readonly label: string;
  readonly color: string | null;
}

interface GraphTopBarProps {
  readonly activeTypes: readonly string[];
  readonly onToggleType: (type: string) => void;
  readonly nodeTypes: readonly NodeTypeOption[];
  readonly currentView: GraphView;
  readonly onChangeView: (view: GraphView) => void;
}

const VIEW_LABELS: Record<GraphView, string> = {
  force:    'Force',
  tree:     'Tree',
  timeline: 'Timeline',
  workflow: 'Workflow',
};

export function GraphTopBar({ activeTypes, onToggleType, nodeTypes, currentView, onChangeView }: GraphTopBarProps) {
  return (
    <div className="absolute top-[49px] left-0 right-0 z-20 flex items-center gap-3 px-4 py-2 bg-gray-950/60 backdrop-blur-sm border-b border-gray-800/30">
      {/* Filter pills */}
      <span className="text-[10px] text-gray-600 uppercase tracking-wider flex-shrink-0">Filter</span>
      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        {nodeTypes.map(type => {
          const isActive = activeTypes.includes(type.id);
          return (
            <button
              key={type.id}
              onClick={() => onToggleType(type.id)}
              className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
              style={{
                backgroundColor: isActive ? (type.color ?? '#888') : 'rgba(31,41,55,0.8)',
                color: isActive ? '#fff' : '#6b7280',
              }}
            >
              {type.label}
            </button>
          );
        })}
      </div>

      {/* View switcher — only force is implemented */}
      <div className="flex items-center gap-1 flex-shrink-0 border border-gray-800 rounded-md overflow-hidden">
        <button
          onClick={() => onChangeView('force')}
          className="px-2.5 py-1 text-xs bg-gray-700 text-gray-200"
        >
          Force
        </button>
        {(['tree', 'timeline', 'workflow'] as GraphView[]).map(view => (
          <button
            key={view}
            disabled
            title="Not yet implemented"
            className="px-2.5 py-1 text-xs text-gray-700 cursor-not-allowed"
          >
            {VIEW_LABELS[view]}
          </button>
        ))}
      </div>
    </div>
  );
}
