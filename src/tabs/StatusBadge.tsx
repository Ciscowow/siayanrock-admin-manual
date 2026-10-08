import type { ReactNode } from 'react'

export function StatusBadge({ children, kind = 'neutral' }: { children: ReactNode; kind?: string }) {
  return <span className={`badge badge-${kind.toLowerCase().replace(' ', '-')}`}><span className="badge-dot" />{children}</span>
}
