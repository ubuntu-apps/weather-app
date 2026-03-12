export type Platform = 'android' | 'ios' | 'desktop'

export type ActiveTab = 'today' | 'forecast' | 'about'

export type DataSource = 'live' | 'cache'

export type TemperatureUnit = 'C' | 'F'

export interface CurrentWeather {
  city: string
  admin1?: string
  country?: string
  temperature: number
  feelsLike: number
  humidity: number
  description: string
  code?: number
  updatedAt: number
}

export interface HourlyEntry {
  time: string
  temperature: number
  apparentTemperature: number
  precipitationProbability?: number
  code?: number
}

export interface ForecastItem {
  date: string
  minTemp: number
  maxTemp: number
  description: string
  code?: number
}

export interface WeatherSnapshot {
  location: string
  latitude: number
  longitude: number
  current: CurrentWeather | null
  forecast: ForecastItem[]
  updatedAt: number
  hourly?: HourlyEntry[]
  sunrise?: string
  sunset?: string
}

export interface GeoCandidate {
  id: string
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

