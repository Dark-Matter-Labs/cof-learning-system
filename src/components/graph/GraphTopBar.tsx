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
    <div className="absolute top-[49px] left-0 right-0 z-20 flex items-center gap-3 px-4 py-2 bg-white/70 dark:bg-gray-950/60 backdrop-blur-sm border-b border-gray-200/60 dark:border-gray-800/30">
      {/* Filter pills */}
      <span className="text-[10px] text-gray-500 dark:text-gray-600 uppercase tracking-wider flex-shrink-0">Filter</span>
      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        {nodeTypes.map(type => {
          const isActive = activeTypes.includes(type.id);
          return (
            <button
              key={type.id}
              onClick={() => onToggleType(type.id)}
              className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                isActive ? '' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500'
              }`}
              style={isActive ? { backgroundColor: type.color ?? '#888', color: '#fff' } : undefined}
            >
              {type.label}
            </button>
          );
        })}
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1 flex-shrink-0 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
        {(['force', 'tree', 'timeline', 'workflow'] as GraphView[]).map(view => (
          <button
            key={view}
            onClick={() => onChangeView(view)}
            className={`px-2.5 py-1 text-xs transition-colors ${
              currentView === view
                ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-400'
            }`}
          >
            {VIEW_LABELS[view]}
          </button>
        ))}
      </div>
    </div>
  );
}
