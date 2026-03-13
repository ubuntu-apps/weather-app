import '../../App.css'

import { useEffect, useState } from 'react'
import type {
  ActiveTab,
  CurrentWeather,
  DataSource,
  ForecastItem,
  GeoCandidate,
  HourlyEntry,
  Platform,
  TemperatureUnit,
  WeatherSnapshot,
} from './weatherTypes'
import { fetchWeatherSnapshot } from './api'
import { LocationInputRow, useLocationLookup } from '../../components/LocationInput'
import { BottomNav, type BottomNavItem } from '../../components/BottomNav'
import { TodayIcon, ForecastIcon, InfoIcon } from '../../components/icons'
import { APP_VERSION } from '../../version'
import { STORAGE_LOCATION_KEY, STORAGE_SNAPSHOT_KEY, STORAGE_UNIT_KEY } from '../../components/LocationInput/locationInputConstants'

type NavigatorLike = Navigator & { vendor?: string }
type WindowLike = Window & { opera?: string }

function describeWeatherCode(code: unknown): string {
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

function glyphForWeatherCode(code: unknown): string | null {
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

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'

  const nav = navigator as NavigatorLike
  const win = window as WindowLike
  const ua = nav.userAgent || nav.vendor || win.opera || ''
  const isAndroid = /android/i.test(ua)
  const isIOS = /iphone|ipad|ipod|ios/i.test(ua)

  if (isAndroid) return 'android'
  if (isIOS) return 'ios'
  return 'desktop'
}

function loadStoredLocation(): string {
  try {
    const fromStorage = localStorage.getItem(STORAGE_LOCATION_KEY)
    if (fromStorage && fromStorage.trim() !== '') return fromStorage
  } catch {
    // ignore
  }
  return 'Zagreb'
}

function loadSnapshot(): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WeatherSnapshot
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function saveLocation(location: string) {
  try {
    localStorage.setItem(STORAGE_LOCATION_KEY, location)
  } catch {
    // ignore
  }
}

function saveSnapshot(snapshot: WeatherSnapshot) {
  try {
    localStorage.setItem(STORAGE_SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore
  }
}

function loadStoredUnit(): TemperatureUnit {
  try {
    const raw = localStorage.getItem(STORAGE_UNIT_KEY)
    if (raw === 'C' || raw === 'F') return raw
  } catch {
    // ignore
  }
  return 'C'
}

function convertTemp(value: number, unit: TemperatureUnit): number {
  if (!Number.isFinite(value)) return 0
  return unit === 'C' ? value : value * (9 / 5) + 32
}

function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

const infoText = `Cross-device weather app.

This app reuses the same shell patterns as the mortgage calculator:
- Centered app shell with max width
- Platform-specific tweaks for Android / iOS / desktop
- Fixed bottom navigation bar with large tap targets

It also stores your chosen city and last known weather so it can show something useful even when offline.`

export function WeatherScreen() {
  const [platform] = useState<Platform>(() => detectPlatform())
  const [activeTab, setActiveTab] = useState<ActiveTab>('today')
  const [location, setLocation] = useState<string>(() => loadStoredLocation())
  const [inputLocation, setInputLocation] = useState<string>(() => loadStoredLocation())
  const [current, setCurrent] = useState<CurrentWeather | null>(() => {
    const snapshot = loadSnapshot()
    return snapshot?.current ?? null
  })
  const [forecast, setForecast] = useState<ForecastItem[]>(() => {
    const snapshot = loadSnapshot()
    return snapshot?.forecast ?? []
  })
  const [hourly, setHourly] = useState<HourlyEntry[]>(() => {
    const snapshot = loadSnapshot()
    return snapshot?.hourly ?? []
  })
  const [sunrise, setSunrise] = useState<string | null>(() => {
    const snapshot = loadSnapshot()
    return snapshot?.sunrise ?? null
  })
  const [sunset, setSunset] = useState<string | null>(() => {
    const snapshot = loadSnapshot()
    return snapshot?.sunset ?? null
  })
  const [dataSource, setDataSource] = useState<DataSource | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const [unit, setUnit] = useState<TemperatureUnit>(() => loadStoredUnit())
  const { candidates, runLookup, clearCandidates } = useLocationLookup()

  useEffect(() => {
    function handleOnline() {
      setOffline(false)
    }

    function handleOffline() {
      setOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchWeather() {
      if (!location.trim()) return

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const snapshot = loadSnapshot()
        if (snapshot && snapshot.location.toLowerCase() === location.toLowerCase()) {
          if (!cancelled) {
            setCurrent(snapshot.current)
            setForecast(snapshot.forecast)
            setStatus('success')
            setDataSource('cache')
            setError(null)
          }
          return
        }

        setStatus('error')
        setError('You appear to be offline and no cached data is available for this city.')
        return
      }

      try {
        setStatus('loading')
        setError(null)

        const { primary, candidates: geoCandidates } = await runLookup(location)

        if (geoCandidates.length > 0 && !primary) {
          setStatus('idle')
          setDataSource(null)
          setError('Multiple locations found. Please choose one.')
          return
        }

        if (!primary) {
          throw new Error('City not found. Try a different name.')
        }

        const snapshot = await fetchWeatherSnapshot(location, {
          latitude: primary.latitude,
          longitude: primary.longitude,
          name: primary.name,
          admin1: primary.admin1,
          country: primary.country,
        })

        if (!cancelled) {
          clearCandidates()
          setCurrent(snapshot.current)
          setForecast(snapshot.forecast)
          setHourly(snapshot.hourly ?? [])
          setSunrise(snapshot.sunrise ?? null)
          setSunset(snapshot.sunset ?? null)
          setStatus('success')
          setDataSource('live')
          saveSnapshot(snapshot)
          setError(null)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong while loading weather data.'
        if (!cancelled) {
          setStatus('error')
          setError(message)
        }
      }
    }

    fetchWeather()

    return () => {
      cancelled = true
    }
  }, [location])

  function handleApplyLocation() {
    const trimmed = inputLocation.trim()
    if (!trimmed) return
    setLocation(trimmed)
    saveLocation(trimmed)
  }

  async function handleChooseCandidate(candidate: GeoCandidate) {
    try {
      setStatus('loading')
      setError(null)
      clearCandidates()

      const snapshot = await fetchWeatherSnapshot(location, {
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        name: candidate.name,
        admin1: candidate.admin1,
        country: candidate.country,
      })

      setCurrent(snapshot.current)
      setForecast(snapshot.forecast)
      setHourly(snapshot.hourly ?? [])
      setSunrise(snapshot.sunrise ?? null)
      setSunset(snapshot.sunset ?? null)
      setStatus('success')
      setDataSource('live')
      saveSnapshot(snapshot)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong while loading weather data.'
      setStatus('error')
      setError(message)
    }
  }

  function handleChangeUnit(next: TemperatureUnit) {
    if (next === unit) return
    setUnit(next)
    try {
      localStorage.setItem(STORAGE_UNIT_KEY, next)
    } catch {
      // ignore
    }
  }

  const shellClassName =
    platform === 'android'
      ? 'app-shell app-shell--android'
      : platform === 'ios'
        ? 'app-shell app-shell--ios'
        : 'app-shell app-shell--desktop'

  const updatedLabel =
    current?.updatedAt != null
      ? new Date(current.updatedAt).toLocaleString()
      : 'No data yet'

  const unitSuffix = unit === 'C' ? '°C' : '°F'

  const navItems: BottomNavItem[] = [
    {
      id: 'today',
      label: 'Today',
      icon: <TodayIcon />,
    },
    {
      id: 'forecast',
      label: 'Forecast',
      icon: <ForecastIcon />,
    },
    {
      id: 'about',
      label: 'About',
      icon: <InfoIcon />,
    },
  ]

  return (
    <div className={shellClassName}>
      <header className="app-header">
        <div className="app-header-top">
          <h1 className="app-title">Weather App</h1>
          <span className="app-version">v{APP_VERSION}</span>
        </div>
        <p className="app-subtitle">Today, forecast, and offline-friendly</p>
      </header>

      <main className="app-content">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {activeTab === 'today' ? "Today's weather" : activeTab === 'forecast' ? 'Forecast' : 'About this app'}
            </h2>
          </div>

          <LocationInputRow
            value={inputLocation}
            placeholder="Enter city, state, or ZIP"
            buttonLabel="Location"
            onChange={setInputLocation}
            onApply={handleApplyLocation}
          />

          <div className="unit-toggle-row">
            <button
              type="button"
              className={`unit-pill ${unit === 'C' ? 'unit-pill-active' : ''}`}
              onClick={() => handleChangeUnit('C')}
            >
              °C
            </button>
            <button
              type="button"
              className={`unit-pill ${unit === 'F' ? 'unit-pill-active' : ''}`}
              onClick={() => handleChangeUnit('F')}
            >
              °F
            </button>
          </div>

          <div className="status-row">
            {offline && <span className="status-pill status-pill-offline">Offline</span>}
            {status === 'loading' && <span className="status-pill">Loading…</span>}
            {status === 'success' && dataSource && (
              <span className="status-pill">
                {dataSource === 'live' ? 'Live data' : 'Using last known data'}
              </span>
            )}
          </div>

          {candidates.length > 0 && (
            <div className="location-choices">
              <p className="location-choices-title">
                Multiple locations found for <strong>{location}</strong>. Choose one:
              </p>
              <div className="location-choices-list">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="location-choice"
                    onClick={() => {
                      void handleChooseCandidate(candidate)
                    }}
                  >
                    <span className="location-choice-name">{candidate.name}</span>
                    <span className="location-choice-meta">
                      {[candidate.admin1, candidate.country].filter(Boolean).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'today' && (
            <div className="tabs-body">
              {current ? (
                <div className="weather-today">
                  <div className="weather-today-main">
                    <div>
                      <div className="weather-location">
                        {[current.city, current.admin1, current.country].filter(Boolean).join(', ')}
                      </div>
                      <div className="weather-description">
                        {glyphForWeatherCode(current.code ?? undefined) && (
                          <span className="weather-glyph">{glyphForWeatherCode(current.code ?? undefined)}</span>
                        )}
                        <span>
                          {current.description.charAt(0).toUpperCase() + current.description.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div className="weather-temp-block">
                      <div className="weather-temp">
                        {Math.round(convertTemp(current.temperature, unit))}
                        {unitSuffix}
                      </div>
                      <div className="weather-feels">
                        Feels like {Math.round(convertTemp(current.feelsLike, unit))}
                        {unitSuffix}
                      </div>
                    </div>
                  </div>

                  <div className="weather-metrics">
                    <div className="metric">
                      <div className="metric-label">Humidity</div>
                      <div className="metric-value">{Math.round(current.humidity)}%</div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Sunrise</div>
                      <div className="metric-value metric-updated">{formatTimeLabel(sunrise)}</div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Sunset</div>
                      <div className="metric-value metric-updated">{formatTimeLabel(sunset)}</div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Updated</div>
                      <div className="metric-value metric-updated">{updatedLabel}</div>
                    </div>
                  </div>

                  {hourly.length > 0 && (
                    <div className="hourly-section">
                      <div className="hourly-title">Next 24 hours</div>
                      <div className="hourly-list">
                        {hourly.map((entry) => {
                          const dt = new Date(entry.time)
                          const hourLabel = dt.toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                          const hour = dt.getHours()
                          const isNight = hour < 6 || hour >= 20
                          const baseGlyph = glyphForWeatherCode(entry.code ?? undefined) ?? '·'
                          const glyph =
                            isNight && entry.code === 0
                              ? '🌙'
                              : baseGlyph
                          return (
                            <div key={entry.time} className="hourly-item">
                              <div className="hourly-time">{hourLabel}</div>
                              <div className="hourly-main">
                                <span className="hourly-glyph">{glyph}</span>
                                <span className="hourly-temp">
                                  {Math.round(convertTemp(entry.temperature, unit))}
                                  {unitSuffix}
                                </span>
                              </div>
                              {typeof entry.precipitationProbability === 'number' && (
                                <div className="hourly-pop">
                                  {Math.round(entry.precipitationProbability)}%
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p>No weather data yet. Enter a city and we will load it.</p>
              )}
            </div>
          )}

          {activeTab === 'forecast' && (
            <div className="tabs-body">
              {forecast.length === 0 ? (
                <p>No forecast available yet. Once we have current weather, we will show a 5-day view here.</p>
              ) : (
                <div className="forecast-list">
                  {forecast.map((item) => (
                    <div key={item.date} className="forecast-item">
                      <div className="forecast-date">
                        {new Date(item.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="forecast-main">
                        <div className="forecast-description">
                          {glyphForWeatherCode(item.code ?? undefined) && (
                            <span className="forecast-glyph">
                              {glyphForWeatherCode(item.code ?? undefined)}
                            </span>
                          )}
                          <span>
                            {item.description.charAt(0).toUpperCase() + item.description.slice(1)}
                          </span>
                        </div>
                        <div className="forecast-temps">
                          <span className="forecast-temp-max">
                            {Math.round(convertTemp(item.maxTemp, unit))}
                            {unitSuffix}
                          </span>
                          <span className="forecast-temp-min">
                            {Math.round(convertTemp(item.minTemp, unit))}
                            {unitSuffix}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="tabs-body">
              <div className="info-text">{infoText}</div>
            </div>
          )}
        </div>
      </main>

      <BottomNav
        items={navItems}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as ActiveTab)}
      />
    </div>
  )
}

