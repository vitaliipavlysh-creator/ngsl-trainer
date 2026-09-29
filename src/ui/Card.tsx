import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`} {...props} />
  );
}
