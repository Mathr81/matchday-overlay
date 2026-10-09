import { panelId, PANELS, STATS, THEMES } from './choices.js'
import { formatClock, periodLabel } from './clock.js'

const BANNERS = [1, 2, 3, 4, 5, 6]
const SIDES = [
	['home', 1],
	['away', 2],
]

export function variableDefinitions() {
	const defs = [
		['connected', 'Connecté à matchday-overlay (oui ou non)'],
		['score', 'Score, par exemple « 2 - 1 »'],
		['clock', 'Chrono'],
		['period', 'Période en toutes lettres'],
		['phase', 'Phase : pre, running, paused, break, shootout, ended'],
		['added_time', 'Temps additionnel annoncé, en minutes'],
		['theme', 'Thème actif'],
		['panel', 'Panneau affiché'],
		['banner', 'Titre du bandeau affiché'],
		['score_visible', 'Score affiché (oui ou non)'],
		['simulation', 'Simulation en cours (oui ou non)'],
		['shootout_next', "Tirs au but : sigle de l'équipe qui doit tirer"],
	]
	for (const [team, n] of SIDES) {
		defs.push([`${team}_name`, `Équipe ${n} : nom`], [`${team}_code`, `Équipe ${n} : sigle`], [`${team}_score`, `Équipe ${n} : buts`], [`${team}_shootout`, `Équipe ${n} : tirs au but marqués`])
		for (const stat of STATS) defs.push([`${team}_${stat.id}`, `Équipe ${n} : ${stat.label.toLowerCase()}`])
	}
	for (const n of BANNERS) defs.push([`banner_${n}`, `Titre du bandeau enregistré ${n}`])
	return defs.map(([variableId, name]) => ({ variableId, name }))
}

const yes = (v) => (v ? 'oui' : 'non')

export function variableValues(state, connected, now) {
	if (!state) return { connected: yes(false) }
	const { config, match, display } = state
	const values = {
		connected: yes(connected),
		score: `${match.score.home} - ${match.score.away}`,
		clock: formatClock(match.clock, config.format, now),
		period: periodLabel(match.clock, config.format),
		phase: match.clock.phase,
		added_time: match.clock.addedMinutes ?? '',
		theme: THEMES.find((t) => t.id === config.theme)?.label ?? config.theme,
		panel: PANELS.find((p) => p.id === panelId(display.panel))?.label ?? '',
		banner: display.banner?.title ?? '',
		score_visible: yes(display.scoreVisible),
		simulation: yes(state.simulation),
		shootout_next: match.shootout?.next ? config.teams[match.shootout.next].code : '',
	}
	for (const [team] of SIDES) {
		values[`${team}_name`] = config.teams[team].name
		values[`${team}_code`] = config.teams[team].code
		values[`${team}_score`] = match.score[team]
		values[`${team}_shootout`] = match.shootout?.score[team] ?? 0
		for (const stat of STATS) values[`${team}_${stat.id}`] = match.stats[team][stat.id]
	}
	for (const n of BANNERS) values[`banner_${n}`] = config.banners[n - 1]?.title ?? ''
	return values
}
