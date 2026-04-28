import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly size?: 'sm' | 'md';
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-node-hunch text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-node-hunch/50',
  secondary: 'bg-transparent border border-cof-border text-cof-text-primary hover:border-cof-border-strong hover:bg-cof-bg-subtle',
  ghost: 'bg-transparent text-cof-text-secondary hover:text-cof-text-primary hover:bg-cof-bg-subtle',
  danger: 'bg-transparent border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
};

export function Button({ variant = 'primary', size = 'md', className = '', disabled, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium transition-all duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${className}
      `.trim()}
    >
      {children}
    </button>
  );
}
