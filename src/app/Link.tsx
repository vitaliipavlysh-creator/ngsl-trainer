import type { AnchorHTMLAttributes } from 'react';

export function Link({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a href={`#${to}`} {...props} />;
}
