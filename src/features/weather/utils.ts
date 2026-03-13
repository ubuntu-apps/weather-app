import type { TemperatureUnit } from './weatherTypes'

export function describeWeatherCode(code: unknown): string {
  const n = typeof code === 'number' ? code : Number(code)

  if (Number.isNaN(n)) return 'Unknown conditions'

  if (n === 0) return 'Clear sky'
  if (n === 1 || n === 2 || n === 3) return 'Partly cloudy'
  if (n === 45 || n === 48) return 'Foggy'
  if (n === 51 || n === 53 || n === 55) return 'Drizzle'
  if (n === 56 || n === 57) return 'Freezing drizzle'
  if (n === 61 || n === 63 || n === 65) return 'Rain'
  if (n === 66 || n === 67) return 'Freezing rain'
  if (n === 71 || n === 73 || n === 75) return 'Snow'
  if (n === 77) return 'Snow grains'
  if (n === 80 || n === 81 || n === 82) return 'Rain showers'
  if (n === 85 || n === 86) return 'Snow showers'
  if (n === 95) return 'Thunderstorm'
  if (n === 96 || n === 99) return 'Thunderstorm with hail'

  return 'Unknown conditions'
}

export function glyphForWeatherCode(code: unknown): string | null {
  const n = typeof code === 'number' ? code : Number(code)
  if (Number.isNaN(n)) return null

  if (n === 0) return '☀️'
  if (n === 1 || n === 2) return '🌤️'
  if (n === 3) return '☁️'
  if (n === 45 || n === 48) return '🌫️'
  if (n === 51 || n === 53 || n === 55) return '🌦️'
  if (n === 56 || n === 57) return '🌧️'
  if (n === 61 || n === 63 || n === 65) return '🌧️'
  if (n === 66 || n === 67) return '🌧️'
  if (n === 71 || n === 73 || n === 75) return '❄️'
  if (n === 77) return '❄️'
  if (n === 80 || n === 81 || n === 82) return '🌦️'
  if (n === 85 || n === 86) return '🌨️'
  if (n === 95) return '⛈️'
  if (n === 96 || n === 99) return '⛈️'

  return null
}

export function convertTemp(value: number, unit: TemperatureUnit): number {
  if (!Number.isFinite(value)) return 0
  return unit === 'C' ? value : value * (9 / 5) + 32
}

export function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

