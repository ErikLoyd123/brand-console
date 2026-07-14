import * as React from 'react'
import { cn } from '../../lib/cn'

const fieldBase =
  'w-full rounded-lg bg-surface text-sm text-text shadow-control outline-none transition-shadow placeholder:text-text-subtle hover:shadow-control-hover focus-visible:shadow-control-hover disabled:opacity-50'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-9 px-3 py-2', className)} {...props} />
  ),
)
Input.displayName = 'Input'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-20 px-3 py-2', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export { Input, Textarea }
