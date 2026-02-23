/**
 * Calendar integration utilities
 */

export function createGoogleCalendarUrl(
  title: string,
  startDate: string, // YYYY-MM-DD
  endDate?: string, // YYYY-MM-DD (optional, defaults to startDate)
  description?: string
): string {
  const start = endDate ? new Date(startDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : new Date(startDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const end = endDate ? new Date(endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: description || ''
  })
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function createAppleCalendarUrl(
  title: string,
  startDate: string, // YYYY-MM-DD
  endDate?: string, // YYYY-MM-DD (optional, defaults to startDate)
  description?: string
): string {
  const start = new Date(startDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const end = endDate ? new Date(endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DESCRIPTION:${description || ''}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n')
  
  return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`
}

export function downloadICSFile(
  title: string,
  startDate: string, // YYYY-MM-DD
  endDate?: string, // YYYY-MM-DD (optional, defaults to startDate)
  description?: string
): void {
  const url = createAppleCalendarUrl(title, startDate, endDate, description)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
