import { useCallback, useState } from 'react'
import type { GeoCandidate } from '../../features/weather/weatherTypes'
import { lookupLocation } from './locationLookup'

type LookupStatus = 'idle' | 'loading' | 'error'

export function useLocationLookup() {
  const [candidates, setCandidates] = useState<GeoCandidate[]>([])
  const [status, setStatus] = useState<LookupStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const runLookup = useCallback(async (rawInput: string) => {
    setStatus('loading')
    setError(null)
    try {
      const result = await lookupLocation(rawInput)
      setCandidates(result.candidates)
      setStatus('idle')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Location lookup failed.'
      setStatus('error')
      setError(message)
      setCandidates([])
      throw err
    }
  }, [])

  const clearCandidates = useCallback(() => {
    setCandidates([])
    setStatus('idle')
    setError(null)
  }, [])

  return {
    candidates,
    status,
    error,
    runLookup,
    clearCandidates,
  }
}

