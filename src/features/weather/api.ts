import type { CurrentWeather, ForecastItem, HourlyEntry, WeatherApiLocation, WeatherSnapshot } from './weatherTypes'

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
    'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code',
  )
  forecastUrl.searchParams.set(
    'hourly',
    'temperature_2m,apparent_temperature,precipitation_probability,weather_code',
  )
  forecastUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset')
  forecastUrl.searchParams.set('forecast_days', '5')
  forecastUrl.searchParams.set('timezone', 'auto')

  const forecastRes = await fetch(forecastUrl.toString())
  if (!forecastRes.ok) {
    throw new Error('Unable to load weather for this location.')
  }

  const forecastJson = (await forecastRes.json()) as any

  const currentBlock = forecastJson.current ?? {}
  const humidityValue = forecastJson.current?.relative_humidity_2m

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

  const forecastItems: ForecastItem[] = dates.map((date, index) => ({
    date,
    minTemp: typeof mins[index] === 'number' ? mins[index] : 0,
    maxTemp: typeof maxes[index] === 'number' ? maxes[index] : 0,
    description: describeWeatherCode(codes[index]),
    code: typeof codes[index] === 'number' ? codes[index] : undefined,
  }))

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

