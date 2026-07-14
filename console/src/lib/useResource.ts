import { useCallback, useEffect, useRef, useState } from 'react'

// The loading / empty / error contract, once, for every fetching view. Tracks a
// request in flight, stashes the payload when it lands, and remembers the thrown
// message on failure — so a real error never looks like an honest empty.
// Emptiness is NOT a hook concern: a view reads `data` and decides empty vs
// content itself, because "empty" is `data.length === 0` for a list but
// `data.funnel` / all-zero totals for OverviewData.
export interface Resource<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): Resource<T> & { reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Guards against out-of-order responses: if `deps` change quickly, an older
  // in-flight fetch can resolve after a newer one. Each call gets an id, and
  // only the call matching the latest id is allowed to commit its result.
  const requestId = useRef(0)

  // `deps` (not `fetcher`) drives re-fetching: views pass an inline arrow whose
  // identity changes every render, so keying off it would loop forever.
  const run = useCallback(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    fetcher()
      .then((result) => {
        if (id === requestId.current) setData(result)
      })
      .catch((err: unknown) => {
        if (id === requestId.current) setError(String(err))
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { data, loading, error, reload: run }
}
