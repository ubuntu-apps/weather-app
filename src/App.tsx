import './App.css'

import { useEffect, useState } from 'react'
import { APP_VERSION } from './version'

type Platform = 'android' | 'ios' | 'desktop'

type ActiveTab = 'today' | 'forecast' | 'about'

type NavigatorLike = Navigator & { vendor?: string }
type WindowLike = Window & { opera?: string }

type DataSource = 'live' | 'cache'

interface CurrentWeather {
  city: string
  admin1?: string
  country?: string
  temperature: number
  feelsLike: number
  humidity: number
  description: string
  icon: string | null
  updatedAt: number
}

interface ForecastItem {
  date: string
  minTemp: number
  maxTemp: number
  description: string
  icon: string | null
}

interface WeatherSnapshot {
  location: string
  latitude: number
  longitude: number
  current: CurrentWeather | null
  forecast: ForecastItem[]
  updatedAt: number
}

const STORAGE_LOCATION_KEY = 'weatherApp:location'
const STORAGE_SNAPSHOT_KEY = 'weatherApp:lastSnapshot'

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

const infoText = `Cross-device weather app.

This app reuses the same shell patterns as the mortgage calculator:
- Centered app shell with max width
- Platform-specific tweaks for Android / iOS / desktop
- Fixed bottom navigation bar with large tap targets

It also stores your chosen city and last known weather so it can show something useful even when offline.`

function App() {
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
  const [dataSource, setDataSource] = useState<DataSource | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false)

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

        const rawInput = location.trim()
        const parts = rawInput.split(',').map((part) => part.trim()).filter((part) => part.length > 0)

        const namePart = parts[0] ?? rawInput
        const maybeCountryPart = parts.length > 1 ? parts[parts.length - 1] : ''
        const twoLetterCountry =
          maybeCountryPart.length === 2 ? maybeCountryPart.toUpperCase() : undefined

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
        const first = Array.isArray(geoJson.results) && geoJson.results.length > 0 ? geoJson.results[0] : null

        if (!first) {
          throw new Error('City not found. Try a different name.')
        }

        const latitude = typeof first.latitude === 'number' ? first.latitude : Number(first.latitude)
        const longitude = typeof first.longitude === 'number' ? first.longitude : Number(first.longitude)
        const resolvedName: string = first.name ?? namePart
        const admin1: string | undefined = first.admin1 ?? undefined
        const country: string | undefined = first.country ?? undefined

        const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
        forecastUrl.searchParams.set('latitude', String(latitude))
        forecastUrl.searchParams.set('longitude', String(longitude))
        forecastUrl.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code')
        forecastUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code')
        forecastUrl.searchParams.set('forecast_days', '5')
        forecastUrl.searchParams.set('timezone', 'auto')

        const forecastRes = await fetch(forecastUrl.toString())

        if (!forecastRes.ok) {
          throw new Error('Unable to load weather for this location.')
        }

        const forecastJson = (await forecastRes.json()) as any

        const currentBlock = forecastJson.current ?? {}
        const humidityValue = forecastJson.current?.relative_humidity_2m

        const now: CurrentWeather = {
          city: resolvedName,
          admin1,
          country,
          temperature: typeof currentBlock.temperature_2m === 'number' ? currentBlock.temperature_2m : 0,
          feelsLike:
            typeof currentBlock.apparent_temperature === 'number'
              ? currentBlock.apparent_temperature
              : typeof currentBlock.temperature_2m === 'number'
                ? currentBlock.temperature_2m
                : 0,
          humidity: typeof humidityValue === 'number' ? humidityValue : 0,
          description: describeWeatherCode(currentBlock.weather_code),
          icon: null,
          updatedAt: Date.now(),
        }

        const daily = forecastJson.daily ?? {}
        const dates: string[] = Array.isArray(daily.time) ? daily.time : []
        const mins: number[] = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : []
        const maxes: number[] = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : []
        const codes: number[] = Array.isArray(daily.weather_code) ? daily.weather_code : []

        const forecastItems: ForecastItem[] = dates.map((date, index) => ({
          date,
          minTemp: typeof mins[index] === 'number' ? mins[index] : 0,
          maxTemp: typeof maxes[index] === 'number' ? maxes[index] : 0,
          description: describeWeatherCode(codes[index]),
          icon: null,
        }))

        const snapshot: WeatherSnapshot = {
          location,
          latitude,
          longitude,
          current: now,
          forecast: forecastItems,
          updatedAt: Date.now(),
        }

        if (!cancelled) {
          setCurrent(now)
          setForecast(forecastItems)
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

          <div className="location-row">
            <div className="location-input-shell">
              <input
                className="location-input"
                value={inputLocation}
                onChange={(event) => setInputLocation(event.target.value)}
                placeholder="Enter city (e.g. Zagreb)"
              />
            </div>
            <button type="button" className="btn-location" onClick={handleApplyLocation}>
              Use city
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
                        {current.description.charAt(0).toUpperCase() + current.description.slice(1)}
                      </div>
                    </div>
                    <div className="weather-temp-block">
                      <div className="weather-temp">{Math.round(current.temperature)}°</div>
                      <div className="weather-feels">Feels like {Math.round(current.feelsLike)}°</div>
                    </div>
                  </div>

                  <div className="weather-metrics">
                    <div className="metric">
                      <div className="metric-label">Humidity</div>
                      <div className="metric-value">{Math.round(current.humidity)}%</div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Updated</div>
                      <div className="metric-value metric-updated">{updatedLabel}</div>
                    </div>
                  </div>
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
                          {item.description.charAt(0).toUpperCase() + item.description.slice(1)}
                        </div>
                        <div className="forecast-temps">
                          <span className="forecast-temp-max">{Math.round(item.maxTemp)}°</span>
                          <span className="forecast-temp-min">{Math.round(item.minTemp)}°</span>
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

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <button
            type="button"
            className={`nav-item ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            <span className="nav-item-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 4a1 1 0 0 1 1 1v1.055a4.5 4.5 0 1 1-2 0V5a1 1 0 0 1 1-1Zm0 5.5a2.5 2.5 0 1 0-2.5-2.5A2.503 2.503 0 0 0 12 9.5Zm-7 3a1 1 0 0 1 1-1h12a1 1 0 0 1 .9 1.436l-2.5 5A1 1 0 0 1 15.5 19h-7a1 1 0 0 1-.9-.564l-2.5-5A1 1 0 0 1 5 12.5Z"
                />
              </svg>
            </span>
            <span className="nav-label">Today</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'forecast' ? 'active' : ''}`}
            onClick={() => setActiveTab('forecast')}
          >
            <span className="nav-item-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M5 6.5A3.5 3.5 0 0 1 8.5 3 3.5 3.5 0 0 1 12 6.5 3.5 3.5 0 0 1 5 6.5Zm9.5-1A3.5 3.5 0 1 1 22 9a3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-.5-3.5Zm-8 7A3.5 3.5 0 0 1 10 16a3.5 3.5 0 1 1-3.5-3.5Zm8.5 1a3.5 3.5 0 1 1 0 7H9a3 3 0 0 1 0-6h6.5Z"
                />
              </svg>
            </span>
            <span className="nav-label">Forecast</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            <span className="nav-item-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 3.25a1.25 1.25 0 1 1-1.25 1.25A1.251 1.251 0 0 1 12 5.25Zm2 12.25h-4a1 1 0 0 1 0-2h1v-4h-.5a1 1 0 0 1 0-2H13a1 1 0 0 1 1 1v5h0a1 1 0 0 1 0 2Z"
                />
              </svg>
            </span>
            <span className="nav-label">About</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

export default App

