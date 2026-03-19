import { Handle, type HandleProps } from '@xyflow/react'
import { cn } from '@/lib/utils'

interface ConnectionHandleProps extends HandleProps {
  label?: string
}

/**
 * Custom React Flow Handle — small circle, white fill, blue border.
 * Invisible until the parent node is hovered (via group-hover CSS).
 * Use inside a node wrapper that has className="group".
 */
export function ConnectionHandle({
  label,
  className,
  ...props
}: ConnectionHandleProps) {
  return (
    <Handle
      {...props}
      title={label ? `Connect: ${label}` : undefined}
      className={cn(
        '!w-3 !h-3 !rounded-full !bg-white !border-2 !border-blue-400',
        '!opacity-0 group-hover:!opacity-100 transition-opacity duration-150',
        className,
      )}
    />
  )
}
