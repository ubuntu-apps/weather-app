import type { GeoCandidate } from '../../features/weather/weatherTypes'
import { US_STATE_MAP } from './locationInputConstants'

export interface LocationLookupResult {
  primary: GeoCandidate | null
  candidates: GeoCandidate[]
}

export async function lookupLocation(rawInput: string): Promise<LocationLookupResult> {
  const trimmed = rawInput.trim()
  if (!trimmed) {
    throw new Error('City is empty.')
  }

  const isUSZip = /^\d{5}$/.test(trimmed)

  let effectiveInput = trimmed
  if (!isUSZip && !trimmed.includes(',')) {
    const tokens = trimmed.split(/\s+/).filter((token) => token.length > 0)
    if (tokens.length >= 2) {
      const lastToken = tokens[tokens.length - 1].toUpperCase()
      if (lastToken.length === 2 && US_STATE_MAP[lastToken]) {
        const cityPart = tokens.slice(0, -1).join(' ')
        effectiveInput = `${cityPart}, ${lastToken}`
      }
    }
  }

  const parts = effectiveInput.split(',').map((part) => part.trim()).filter((part) => part.length > 0)

  const namePart = parts[0] ?? effectiveInput
  let twoLetterCountry: string | undefined
  let adminHint = ''

  if (isUSZip) {
    twoLetterCountry = 'US'
  } else if (parts.length > 1) {
    const lastPart = parts[parts.length - 1] ?? ''
    const lastUpper = lastPart.toUpperCase()
    if (lastPart.length === 2 && US_STATE_MAP[lastUpper]) {
      twoLetterCountry = 'US'
      adminHint = US_STATE_MAP[lastUpper].toLowerCase()
    } else if (lastPart.length === 2) {
      twoLetterCountry = lastUpper
    }
    if (!adminHint && parts[1]) {
      adminHint = parts[1].toLowerCase()
    }
  }

  const params = new URLSearchParams()
  params.set('name', namePart)
  params.set('count', '5')
  params.set('language', 'en')
  params.set('format', 'json')
  if (twoLetterCountry) {
    params.set('country_code', twoLetterCountry)
  }

  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`)

  if (!geoRes.ok) {
    throw new Error('Unable to look up this city.')
  }

  const geoJson = (await geoRes.json()) as any
  const results: any[] = Array.isArray(geoJson.results) ? geoJson.results : []

  if (results.length === 0) {
    throw new Error('City not found. Try a different name.')
  }

  let filtered = results

  if (isUSZip) {
    const usOnly = results.filter((item) => {
      const code = String(item.country_code ?? '').toUpperCase()
      const countryName = String(item.country ?? '')
      return code === 'US' || countryName.includes('United States')
    })
    if (usOnly.length > 0) {
      filtered = usOnly
    }
  }

  if (adminHint) {
    const adminLower = adminHint.toLowerCase()
    const byAdmin = filtered.filter((item) =>
      String(item.admin1 ?? '').toLowerCase().includes(adminLower),
    )
    if (byAdmin.length > 0) {
      filtered = byAdmin
    }
  }

  const showList = !isUSZip && !adminHint && filtered.length > 1

  if (showList) {
    const candidates: GeoCandidate[] = filtered.map((item) => ({
      id: String(item.id ?? `${item.latitude},${item.longitude}`),
      name: item.name ?? namePart,
      admin1: item.admin1 ?? undefined,
      country: item.country ?? undefined,
      latitude: typeof item.latitude === 'number' ? item.latitude : Number(item.latitude),
      longitude: typeof item.longitude === 'number' ? item.longitude : Number(item.longitude),
    }))
    return { primary: null, candidates }
  }

  const first = filtered[0]

  const primary: GeoCandidate = {
    id: String(first.id ?? `${first.latitude},${first.longitude}`),
    name: first.name ?? namePart,
    admin1: first.admin1 ?? undefined,
    country: first.country ?? undefined,
    latitude: typeof first.latitude === 'number' ? first.latitude : Number(first.latitude),
    longitude: typeof first.longitude === 'number' ? first.longitude : Number(first.longitude),
  }

  return { primary, candidates: [] }
}

