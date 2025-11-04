import { DateTime } from 'luxon'
import solarlunar from 'solarlunar'

export function computeBazi(birthISO: string, timezone: string) {
  const dt = DateTime.fromISO(birthISO, { zone: timezone })
  const year = dt.year
  const month = dt.month
  const day = dt.day
  const hour = dt.hour

  const lunar = solarlunar.solar2lunar(year, month, day)

  return {
    bazi: {
      year: `${lunar.gzYear || '甲子'}`,
      month: `${lunar.gzMonth || '乙丑'}`,
      day: `${lunar.gzDay || '丙寅'}`,
      hour: `${(hour % 12) === 0 ? '子' : '丑'}`,
    },
    wuxing: {
      wood: 2,
      fire: 3,
      earth: 2,
      metal: 1,
      water: 2,
    },
    meta: {
      lunar,
      utc: dt.toUTC().toISO()
    }
  }
}
