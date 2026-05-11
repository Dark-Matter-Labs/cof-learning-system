interface SkeletonProps {
  readonly className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-skeleton rounded ${className ?? ''}`}
      style={{ background: 'var(--color-border)' }}
    />
  );
}
