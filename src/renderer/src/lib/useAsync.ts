import { useEffect, useState } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): {
  data: T | null
  loading: boolean
  error: unknown
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fn()
      .then((res) => {
        if (alive) {
          setData(res)
          setError(null)
        }
      })
      .catch((e) => {
        if (alive) setError(e)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
