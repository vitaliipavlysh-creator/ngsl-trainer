import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'forgot' | 'remembered' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-2 text-fg hover:brightness-95 dark:hover:brightness-125',
  ghost: 'text-fg hover:bg-surface-2',
  forgot: 'bg-queued text-on-status hover:brightness-110 active:brightness-95',
  remembered: 'bg-known text-on-status hover:brightness-110 active:brightness-95',
  danger: 'border border-queued/50 text-queued hover:bg-queued/10',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const sizes = size === 'lg' ? 'min-h-14 px-5 text-base' : 'min-h-11 px-4 text-[15px]';
  return (
    <button
      type="button"
      className={`inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 ${sizes} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
