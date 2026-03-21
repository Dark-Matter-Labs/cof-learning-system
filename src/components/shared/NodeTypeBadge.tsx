const NODE_TYPE_COLORS: Record<string, string> = {
  hunch: 'bg-node-hunch',
  assumption_background: 'bg-node-assumption-bg',
  assumption_foreground: 'bg-node-assumption-fg',
  test: 'bg-node-test',
  learning: 'bg-node-learning',
  option: 'bg-node-option',
  person: 'bg-node-entity',
  organisation: 'bg-node-entity',
  site: 'bg-node-site',
};

interface NodeTypeBadgeProps {
  readonly nodeType: string;
  readonly label?: string;
}

export function NodeTypeBadge({ nodeType, label }: NodeTypeBadgeProps) {
  const colorClass = NODE_TYPE_COLORS[nodeType] ?? 'bg-gray-600';
  const displayLabel = label ?? nodeType.replace(/_/g, ' ');

  return (
    <span className={`${colorClass} text-white text-xs px-2 py-0.5 rounded-full capitalize`}>
      {displayLabel}
    </span>
  );
}
