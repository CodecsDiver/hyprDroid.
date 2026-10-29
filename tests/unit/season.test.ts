// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { deriveEnvironment, seasonFor } from '@/domain/environment'
import { WeatherSystem } from '@/scene/weather'

describe('seasons', () => {
  it('maps every month to a season (northern hemisphere)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(seasonFor)).toEqual([
      'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
    ])
  })

  it('is part of the derived environment, from the real date', () => {
    expect(deriveEnvironment({ moods: [], now: new Date(2025, 11, 24, 12) }).season).toBe('winter')
    expect(deriveEnvironment({ moods: [], now: new Date(2025, 6, 4, 22) }).season).toBe('summer')
  })
})

describe('seasonal particles', () => {
  const seasonLayer = (weather: WeatherSystem) => weather.group.children[4]!
  const settle = (weather: WeatherSystem): void => {
    for (let i = 0; i < 80; i++) weather.update(0.1, i * 0.1, false)
  }

  it('shows snow, blossom and leaves in daylight, but fireflies only when it is getting dark', () => {
    for (const [season, time, visible] of [['winter', 'day', true], ['spring', 'day', true], ['autumn', 'day', true], ['summer', 'day', false], ['summer', 'night', true], ['summer', 'dusk', true]] as const) {
      const weather = new WeatherSystem('low', 1)
      weather.setSeason(season, time, 'clear')
      settle(weather)
      expect(seasonLayer(weather).visible, `${season} ${time}`).toBe(visible)
      weather.dispose()
    }
  })

  it('keeps leaves and blossom out of the rain, with only a little snow', () => {
    const rainy = (season: 'autumn' | 'winter') => {
      const weather = new WeatherSystem('low', 1)
      weather.setSeason(season, 'day', 'rain')
      settle(weather)
      const shown = seasonLayer(weather).visible
      weather.dispose()
      return shown
    }
    expect(rainy('autumn')).toBe(false)
    expect(rainy('winter')).toBe(true)
  })

  it('keeps particles inside the room volume as they fall', () => {
    const weather = new WeatherSystem('medium', 1)
    weather.setSeason('winter', 'day', 'clear')
    settle(weather)
    const positions = (seasonLayer(weather) as unknown as { geometry: { getAttribute(n: string): { array: Float32Array } } }).geometry.getAttribute('position').array
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i + 1]).toBeGreaterThanOrEqual(0)
      expect(positions[i + 1]).toBeLessThanOrEqual(4.2)
    }
    weather.dispose()
  })
})
