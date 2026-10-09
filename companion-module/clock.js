// Même calcul que les pages de matchday-overlay (src/shared/clock.ts), pour afficher le chrono sur un bouton.

const periodLength = (format, period) => (period > format.periods ? format.extraTime.periodMinutes : format.periodMinutes) * 60_000
const maxPeriods = (format) => format.periods + (format.extraTime.enabled ? 2 : 0)

function mmss(ms, padMinutes) {
	const s = Math.floor(ms / 1000)
	const m = String(Math.floor(s / 60))
	return `${padMinutes ? m.padStart(2, '0') : m}:${String(s % 60).padStart(2, '0')}`
}

/** « 67:24 » dans le temps réglementaire, « 45+2:13 » au-delà. */
export function formatClock(clock, format, now) {
	if (clock.period === 0) return '00:00'
	const length = periodLength(format, clock.period)
	const within = clock.elapsedMs + (clock.anchorAt === null ? 0 : Math.max(0, now - clock.anchorAt))
	if (within < length) return mmss(clock.baseMs + within, true)
	return `${(clock.baseMs + length) / 60_000}+${mmss(within - length, false)}`
}

export function periodLabel(clock, format) {
	if (clock.phase === 'pre') return 'Avant-match'
	if (clock.phase === 'ended') return 'Terminé'
	if (clock.phase === 'shootout') return 'Tirs au but'
	if (clock.phase === 'break') {
		if (clock.period === maxPeriods(format) && clock.period > format.periods) return 'Fin des prolongations'
		if (clock.period === format.periods) return 'Fin du temps réglementaire'
		return format.periods === 2 && clock.period === 1 ? 'Mi-temps' : 'Pause'
	}
	if (clock.period > format.periods) return `Prolongation ${clock.period - format.periods}`
	if (format.periods === 2) return clock.period === 1 ? '1re mi-temps' : '2e mi-temps'
	return `Période ${clock.period}`
}
