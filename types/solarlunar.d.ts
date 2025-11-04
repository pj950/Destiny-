declare module 'solarlunar' {
  interface LunarDate {
    lYear: number
    lMonth: number
    lDay: number
    Animal: string
    IMonthCn: string
    IDayCn: string
    cYear: number
    cMonth: number
    cDay: number
    gzYear: string
    gzMonth: string
    gzDay: string
    isToday: boolean
    isLeap: boolean
    nWeek: number
    ncWeek: string
    isTerm: boolean
    Term: string | null
  }

  interface SolarLunar {
    solar2lunar(year: number, month: number, day: number): LunarDate
    lunar2solar(year: number, month: number, day: number, isLeap?: boolean): LunarDate
  }

  const solarlunar: SolarLunar
  export default solarlunar
}
