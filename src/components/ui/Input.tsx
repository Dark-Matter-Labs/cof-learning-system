import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string;
  readonly error?: string;
  readonly helper?: string;
}

export function Input({ label, error, helper, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-cof-text-secondary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`
          w-full text-sm px-3 py-2
          bg-cof-bg-elevated
          border rounded-lg
          text-cof-text-primary placeholder:text-cof-text-tertiary
          transition-colors duration-150
          focus:outline-none
          ${error
            ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400/30'
            : 'border-cof-border hover:border-cof-border-strong focus:border-node-hunch focus:ring-1 focus:ring-node-hunch/20'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          text-[16px] sm:text-sm
          ${className}
        `.trim()}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {helper && !error && <p className="text-xs text-cof-text-tertiary">{helper}</p>}
    </div>
  );
}
