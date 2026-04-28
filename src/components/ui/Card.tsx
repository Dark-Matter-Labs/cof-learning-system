import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly hover?: boolean;
  readonly padding?: 'sm' | 'md' | 'lg';
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ hover = false, padding = 'md', className = '', children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`
        bg-cof-bg-elevated
        border border-cof-border
        rounded-xl
        ${PADDING_CLASSES[padding]}
        ${hover ? 'card-hover cursor-pointer' : ''}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
