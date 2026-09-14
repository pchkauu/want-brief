export function hours(seconds: number): string {
  const h = seconds / 3600
  if (h < 0.1) return `${Math.round(seconds / 60)}m`
  return `${h.toFixed(1)}h`
}

export function elapsed(startedAt: string, now = Date.now()): string {
  const ms = now - new Date(startedAt).getTime()
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
