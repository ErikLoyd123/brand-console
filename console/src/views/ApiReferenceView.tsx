import { useEffect, useRef } from 'react'
import { createApiReference } from '@scalar/api-reference'
import '@scalar/api-reference/style.css'
import { PageHeader } from '../components/kit'

// The API reference is a documentation surface, not an operational one. It mounts
// Scalar's reference against the committed /openapi.json (served from
// console/public). The installed @scalar/api-reference package (1.62.x) is a Vue
// component library with no React wrapper export, so this view uses the package's
// documented vanilla mount API (`createApiReference`) against a ref'd container and
// tears it down on unmount. The spec is the source of truth until the server serves
// its own at GET /api/openapi.json. This view lays out full-width, mirroring
// DatabaseView; the shell enables that width via the `wide` condition in App.tsx
// (phase 04).
export function ApiReferenceView() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const instance = createApiReference(containerRef.current, { url: '/openapi.json' })
    return () => instance.destroy()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="System · API"
        title="API Reference"
        description="Every endpoint the local content-engine server exposes — what each takes and returns. Read-only reference, no credentials."
      />
      <div className="overflow-hidden rounded-lg bg-surface shadow-sm">
        <div ref={containerRef} />
      </div>
    </div>
  )
}
