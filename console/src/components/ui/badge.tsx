import * as React from 'react'
import { cn } from '../../lib/cn'

// Base pill. PillarBadge and TagBadge pass explicit -bg/-fg classes per variant.
function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
