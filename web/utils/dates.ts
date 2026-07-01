export function fmtDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

export function fmtTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function fmtDateTime(iso: string | Date) {
  return `${fmtDate(iso)} at ${fmtTime(iso)}`
}

/** "in 2 days", "in 5 hours", "closed" — for RSVP deadlines. */
export function deadlineCountdown(iso: string | Date) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'closed'
  const hours = Math.round(ms / 3600_000)
  if (hours < 1) return `closes in ${Math.max(1, Math.round(ms / 60_000))} min`
  if (hours < 48) return `closes in ${hours} hour${hours === 1 ? '' : 's'}`
  return `closes in ${Math.round(hours / 24)} days`
}

/** ISO -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string | Date) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
