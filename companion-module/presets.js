import { combineRgb } from '@companion-module/base'
import { PANELS, STATS, THEMES } from './choices.js'

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const DARK = combineRgb(28, 30, 36)
const GREEN = combineRgb(0, 150, 70)
const RED = combineRgb(200, 30, 30)
const YELLOW = combineRgb(245, 200, 0)
const ORANGE = combineRgb(235, 90, 10)

const PANEL_TEXT = {
	prematch: 'AVANT\\nMATCH',
	summary: 'RÉSUMÉ',
	stats: 'STATS',
	holding: 'ATTENTE',
}

/** Couleur d'équipe « #rrggbb » → fond de bouton, avec un texte lisible dessus. */
function teamStyle(hex) {
	const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '')
	if (!m) return { bgcolor: DARK, color: WHITE }
	const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16))
	return { bgcolor: combineRgb(r, g, b), color: 0.299 * r + 0.587 * g + 0.114 * b > 150 ? BLACK : WHITE }
}

export function buildPresets(self) {
	const v = (name) => `$(${self.label}:${name})`
	const config = self.state?.config
	const presets = {}
	const add = (id, category, name, text, style, actions, feedbacks = []) => {
		presets[id] = {
			type: 'button',
			category,
			name,
			style: { text, size: 'auto', color: WHITE, bgcolor: DARK, ...style },
			steps: [{ down: actions.map(([actionId, options = {}]) => ({ actionId, options })), up: [] }],
			feedbacks: feedbacks.map(([feedbackId, options = {}, fbStyle = { bgcolor: GREEN, color: WHITE }]) => ({ feedbackId, options, style: fbStyle })),
		}
	}
	const noPlayer = { player_home: '', player_away: '' }

	// ---- affichage ----
	add('score', 'Affichage', 'Score : afficher ou masquer', 'SCORE', {}, [['score_visible', { mode: 'toggle' }]], [['score_visible']])
	add('score_live', 'Affichage', 'Score en direct', `${v('home_code')} ${v('score')} ${v('away_code')}\\n${v('clock')}`, { size: '14' }, [])
	add('clock_live', 'Affichage', 'Chrono en direct', `${v('clock')}\\n${v('period')}`, { size: '14' }, [], [['phase', { phase: 'running' }]])
	add('simulation', 'Affichage', 'Témoin de simulation', 'SIMU', {}, [], [['simulation', {}, { bgcolor: RED, color: WHITE }]])

	for (const p of PANELS.filter((p) => p.id !== 'shootout')) {
		const text = p.id.startsWith('lineup-') ? `COMPO\\n${v(`${p.id.slice(7)}_code`)}` : PANEL_TEXT[p.id]
		add(`panel_${p.id}`, 'Panneaux', p.label, text, {}, [['panel', { panel: p.id, toggle: true }]], [['panel', { panel: p.id }]])
	}
	add('panel_off', 'Panneaux', 'Retirer le panneau', 'PANNEAU\\nOFF', { bgcolor: RED }, [['panel_off']])

	for (const n of [1, 2, 3, 4, 5, 6]) add(`banner_${n}`, 'Bandeaux', `Bandeau ${n}`, v(`banner_${n}`), { size: '14' }, [['banner', { banner: n, toggle: true }]], [['banner', { banner: n }]])
	add('banner_off', 'Bandeaux', 'Retirer le bandeau', 'BANDEAU\\nOFF', { bgcolor: RED }, [['banner_off']])

	for (const t of THEMES) add(`theme_${t.id}`, 'Thèmes', `Thème ${t.label}`, t.label.toUpperCase(), {}, [['theme', { theme: t.id }]], [['theme', { theme: t.id }, { bgcolor: ORANGE, color: WHITE }]])

	// ---- chrono ----
	add('clock_start', 'Chrono', "Coup d'envoi de la période suivante", "COUP\\nD'ENVOI", { bgcolor: GREEN }, [['clock_start']])
	add('clock_toggle', 'Chrono', 'Pause ou reprise', `PAUSE\\n${v('clock')}`, {}, [['clock_toggle']], [['phase', { phase: 'paused' }, { bgcolor: YELLOW, color: BLACK }]])
	add('clock_end', 'Chrono', 'Fin de la période', 'FIN\\nPÉRIODE', { bgcolor: RED }, [['clock_end_period']])
	for (const n of [1, 2, 3, 4, 5]) add(`added_${n}`, 'Chrono', `Temps additionnel +${n}`, `+${n}'`, {}, [['added_time', { minutes: n }]])
	add('added_0', 'Chrono', 'Retirer le temps additionnel', "+0'", {}, [['added_time', { minutes: 0 }]])

	// ---- match ----
	for (const [team, n] of [
		['home', 1],
		['away', 2],
	]) {
		const style = teamStyle(config?.teams[team].color)
		const code = v(`${team}_code`)
		const cat = `Équipe ${n}`
		add(`goal_${team}`, cat, 'But', `BUT\\n${code}`, style, [['goal', { team, kind: 'normal', ...noPlayer, silent: false }]])
		add(`goal_pen_${team}`, cat, 'But sur penalty', `BUT PEN\\n${code}`, style, [['goal', { team, kind: 'penalty', ...noPlayer, silent: false }]])
		add(`score_fix_${team}`, cat, 'Corriger le score (+1 sans animation)', `+1\\n${code}`, {}, [['goal', { team, kind: 'normal', ...noPlayer, silent: true }]])
		add(`yellow_${team}`, cat, 'Carton jaune', `JAUNE\\n${code}`, { bgcolor: YELLOW, color: BLACK }, [['card', { team, color: 'yellow', ...noPlayer }]])
		add(`red_${team}`, cat, 'Carton rouge', `ROUGE\\n${code}`, { bgcolor: RED }, [['card', { team, color: 'red', ...noPlayer }]])
		add(`penalty_${team}`, cat, 'Penalty annoncé', `PENALTY\\n${code}`, style, [['penalty', { team }]])
		add(`penalty_missed_${team}`, cat, 'Penalty raté', `PEN RATÉ\\n${code}`, {}, [['penalty_missed', { team, ...noPlayer }]])
		add(`team_score_${team}`, cat, "Score de l'équipe", `${code}\\n${v(`${team}_score`)}`, { size: '18' }, [], [['leading', { team }, style]])
		for (const stat of STATS) {
			add(`stat_${stat.id}_${team}`, `Stats équipe ${n}`, `${stat.label} +1`, `${stat.label.toUpperCase()}\\n${code} ${v(`${team}_${stat.id}`)}`, { size: '14' }, [['stat', { team, key: stat.id, delta: 1 }]])
		}
	}
	add('end_match', 'Match', 'Terminer le match', 'FIN DU\\nMATCH', { bgcolor: RED }, [['end_match']])
	add('winner', 'Match', 'Annoncer le vainqueur', 'VAINQUEUR', { bgcolor: ORANGE }, [['announce_winner']])

	// ---- tirs au but ----
	add('shootout_home', 'Tirs au but', 'Commencer, équipe 1 en premier', `TAB\\n${v('home_code')} 1er`, {}, [['shootout_start', { team: 'home' }]])
	add('shootout_away', 'Tirs au but', 'Commencer, équipe 2 en premier', `TAB\\n${v('away_code')} 1er`, {}, [['shootout_start', { team: 'away' }]])
	add('kick_yes', 'Tirs au but', 'Tir marqué', `MARQUÉ\\n${v('shootout_next')}`, { bgcolor: GREEN }, [['shootout_kick', { scored: 'yes' }]])
	add('kick_no', 'Tirs au but', 'Tir raté', `RATÉ\\n${v('shootout_next')}`, { bgcolor: RED }, [['shootout_kick', { scored: 'no' }]])
	add('shootout_score', 'Tirs au but', 'Score de la séance', `TAB\\n${v('home_shootout')} - ${v('away_shootout')}`, { size: '18' }, [], [['phase', { phase: 'shootout' }]])

	return presets
}
