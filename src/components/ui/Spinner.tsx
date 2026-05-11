import type { CSSProperties } from 'react';

const SIZE_PX: Record<string, number> = { sm: 14, md: 18, lg: 24, xl: 32 };

interface SpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg' | 'xl';
  readonly label?: string;
  readonly className?: string;
}

export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  const px = SIZE_PX[size];
  const style: CSSProperties = {
    width: px,
    height: px,
    borderWidth: Math.max(2, Math.round(px / 10)),
    color: 'var(--color-text-secondary)',
  };
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${className ?? ''}`}
      style={style}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
