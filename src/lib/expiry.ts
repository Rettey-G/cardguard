export function toStartOfDayMs(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function parseYmdToDate(ymd: string): Date {
  // ymd: YYYY-MM-DD
  const [y, m, d] = ymd.split('-').map((v) => Number(v))
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function daysUntil(ymd: string, now = new Date()): number {
  const today = toStartOfDayMs(now)
  const target = toStartOfDayMs(parseYmdToDate(ymd))
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

export function isExpired(ymd: string, now = new Date()): boolean {
  return daysUntil(ymd, now) < 0
}
