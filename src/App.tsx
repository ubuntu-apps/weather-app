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
  current: CurrentWeather | null
  forecast: ForecastItem[]
  updatedAt: number
}

const STORAGE_LOCATION_KEY = 'weatherApp:location'
const STORAGE_SNAPSHOT_KEY = 'weatherApp:lastSnapshot'

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

      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined

      if (!apiKey) {
        setStatus('error')
        setError('Missing VITE_OPENWEATHER_API_KEY. Add it to a .env file.')
        return
      }

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

        const encodedLocation = encodeURIComponent(location.trim())
        const units = 'metric'

        const [currentRes, forecastRes] = await Promise.all([
          fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodedLocation}&units=${units}&appid=${apiKey}`,
          ),
          fetch(
            `https://api.openweathermap.org/data/2.5/forecast?q=${encodedLocation}&units=${units}&appid=${apiKey}`,
          ),
        ])

        if (!currentRes.ok) {
          throw new Error('Unable to load current weather for this city.')
        }

        if (!forecastRes.ok) {
          throw new Error('Unable to load forecast for this city.')
        }

        const currentJson = (await currentRes.json()) as any
        const forecastJson = (await forecastRes.json()) as any

        const now: CurrentWeather = {
          city: currentJson.name ?? location,
          country: currentJson.sys?.country,
          temperature: currentJson.main?.temp ?? 0,
          feelsLike: currentJson.main?.feels_like ?? currentJson.main?.temp ?? 0,
          humidity: currentJson.main?.humidity ?? 0,
          description: currentJson.weather?.[0]?.description ?? 'Unknown conditions',
          icon: currentJson.weather?.[0]?.icon ?? null,
          updatedAt: Date.now(),
        }

        const byDay = new Map<string, { min: number; max: number; description: string; icon: string | null }>()

        const list: any[] = Array.isArray(forecastJson.list) ? forecastJson.list : []

        for (const entry of list) {
          const dt = typeof entry.dt === 'number' ? entry.dt * 1000 : Date.now()
          const date = new Date(dt)
          const key = date.toISOString().slice(0, 10)
          const tempMin = entry.main?.temp_min ?? entry.main?.temp ?? 0
          const tempMax = entry.main?.temp_max ?? entry.main?.temp ?? 0
          const description = entry.weather?.[0]?.description ?? 'Unknown'
          const icon = entry.weather?.[0]?.icon ?? null

          const existing = byDay.get(key)
          if (!existing) {
            byDay.set(key, { min: tempMin, max: tempMax, description, icon })
          } else {
            byDay.set(key, {
              min: Math.min(existing.min, tempMin),
              max: Math.max(existing.max, tempMax),
              description: existing.description,
              icon: existing.icon,
            })
          }
        }

        const todayKey = new Date().toISOString().slice(0, 10)

        const forecastItems: ForecastItem[] = Array.from(byDay.entries())
          .filter(([key]) => key >= todayKey)
          .slice(0, 5)
          .map(([key, value]) => ({
            date: key,
            minTemp: value.min,
            maxTemp: value.max,
            description: value.description,
            icon: value.icon,
          }))

        const snapshot: WeatherSnapshot = {
          location,
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
                        {current.city}
                        {current.country ? `, ${current.country}` : ''}
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

