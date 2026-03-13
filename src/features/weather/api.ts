import type { CurrentWeather, ForecastItem, HourlyEntry, WeatherApiLocation, WeatherSnapshot } from './weatherTypes'
import { describeWeatherCode } from './utils'

export async function fetchWeatherSnapshot(
  locationLabel: string,
  apiLocation: WeatherApiLocation,
): Promise<WeatherSnapshot> {
  const { latitude, longitude, name, admin1, country } = apiLocation

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
  forecastUrl.searchParams.set('latitude', String(latitude))
  forecastUrl.searchParams.set('longitude', String(longitude))
  forecastUrl.searchParams.set(
    'current',
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'weather_code',
      'wind_speed_10m',
      'surface_pressure',
    ].join(','),
  )
  forecastUrl.searchParams.set(
    'hourly',
    'temperature_2m,apparent_temperature,precipitation_probability,weather_code',
  )
  forecastUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset')
  // request enough days that, after skipping today, we can show a 15‑day forecast
  forecastUrl.searchParams.set('forecast_days', '16')
  forecastUrl.searchParams.set('timezone', 'auto')

  const forecastRes = await fetch(forecastUrl.toString())
  if (!forecastRes.ok) {
    throw new Error('Unable to load weather for this location.')
  }

  const forecastJson = (await forecastRes.json()) as any

  const currentBlock = forecastJson.current ?? {}
  const humidityValue = forecastJson.current?.relative_humidity_2m
  const windSpeedValue = forecastJson.current?.wind_speed_10m
  const pressureValue = forecastJson.current?.surface_pressure

  const current: CurrentWeather = {
    city: name,
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
    windSpeed: typeof windSpeedValue === 'number' ? windSpeedValue : undefined,
    pressure: typeof pressureValue === 'number' ? pressureValue : undefined,
    description: describeWeatherCode(currentBlock.weather_code),
    code: typeof currentBlock.weather_code === 'number' ? currentBlock.weather_code : undefined,
    updatedAt: Date.now(),
  }

  const daily = forecastJson.daily ?? {}
  const dates: string[] = Array.isArray(daily.time) ? daily.time : []
  const mins: number[] = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : []
  const maxes: number[] = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : []
  const codes: number[] = Array.isArray(daily.weather_code) ? daily.weather_code : []
  const sunrises: string[] = Array.isArray(daily.sunrise) ? daily.sunrise : []
  const sunsets: string[] = Array.isArray(daily.sunset) ? daily.sunset : []

  const allForecastItems: ForecastItem[] = dates.map((date, index) => ({
    date,
    minTemp: typeof mins[index] === 'number' ? mins[index] : 0,
    maxTemp: typeof maxes[index] === 'number' ? maxes[index] : 0,
    description: describeWeatherCode(codes[index]),
    code: typeof codes[index] === 'number' ? codes[index] : undefined,
  }))

  // Derive "today" in the location's timezone using utc_offset_seconds,
  // then start the forecast strictly after that (tomorrow) and take 15 days.
  const offsetSeconds = typeof forecastJson.utc_offset_seconds === 'number'
    ? forecastJson.utc_offset_seconds
    : 0
  const locationNow = new Date(Date.now() + offsetSeconds * 1000)
  const todayKey = locationNow.toISOString().slice(0, 10)

  const forecastItems: ForecastItem[] = allForecastItems
    .filter((item) => item.date > todayKey)
    .slice(0, 15)

  const hourlyBlock = forecastJson.hourly ?? {}
  const hourlyTimes: string[] = Array.isArray(hourlyBlock.time) ? hourlyBlock.time : []
  const hourlyTemps: number[] = Array.isArray(hourlyBlock.temperature_2m) ? hourlyBlock.temperature_2m : []
  const hourlyApparent: number[] = Array.isArray(hourlyBlock.apparent_temperature)
    ? hourlyBlock.apparent_temperature
    : []
  const hourlyPop: number[] = Array.isArray(hourlyBlock.precipitation_probability)
    ? hourlyBlock.precipitation_probability
    : []
  const hourlyCodes: number[] = Array.isArray(hourlyBlock.weather_code) ? hourlyBlock.weather_code : []

  const nowTime = Date.now()
  const cutoff = nowTime + 24 * 60 * 60 * 1000

  const hourlyItems: HourlyEntry[] = hourlyTimes
    .map((time, index) => {
      const ts = Date.parse(time)
      if (Number.isNaN(ts)) return null
      if (ts < nowTime || ts > cutoff) return null
      return {
        time,
        temperature: typeof hourlyTemps[index] === 'number' ? hourlyTemps[index] : 0,
        apparentTemperature:
          typeof hourlyApparent[index] === 'number'
            ? hourlyApparent[index]
            : typeof hourlyTemps[index] === 'number'
              ? hourlyTemps[index]
              : 0,
        precipitationProbability: typeof hourlyPop[index] === 'number' ? hourlyPop[index] : undefined,
        code: typeof hourlyCodes[index] === 'number' ? hourlyCodes[index] : undefined,
      } as HourlyEntry
    })
    .filter((entry): entry is HourlyEntry => entry !== null)

  const todaySunrise = sunrises[0] ?? null
  const todaySunset = sunsets[0] ?? null

  return {
    location: locationLabel,
    latitude,
    longitude,
    current,
    forecast: forecastItems,
    hourly: hourlyItems,
    sunrise: todaySunrise ?? undefined,
    sunset: todaySunset ?? undefined,
    updatedAt: Date.now(),
  }
}

