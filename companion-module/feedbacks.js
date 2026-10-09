import { combineRgb } from '@companion-module/base'
import { bannerChoices, panelId, PANELS, PHASES, teamChoices, THEMES } from './choices.js'

const ON = { bgcolor: combineRgb(0, 150, 70), color: combineRgb(255, 255, 255) }
const ALERT = { bgcolor: combineRgb(200, 30, 30), color: combineRgb(255, 255, 255) }

export function buildFeedbacks(self) {
	const config = self.state?.config
	const any = { id: 'any', label: "N'importe lequel" }
	const bool = (name, description, defaultStyle, options, test) => ({
		type: 'boolean',
		name,
		description,
		defaultStyle,
		options,
		callback: (feedback) => !!self.state && !!test(self.state, feedback.options),
	})

	return {
		score_visible: bool('Score affiché', "Vrai quand le score est à l'antenne.", ON, [], (s) => s.display.scoreVisible),
		panel: bool(
			'Panneau affiché',
			"Vrai quand ce panneau est à l'antenne.",
			ON,
			[{ id: 'panel', type: 'dropdown', label: 'Panneau', default: 'summary', choices: [any, ...PANELS] }],
			(s, o) => (o.panel === 'any' ? s.display.panel !== null : panelId(s.display.panel) === o.panel),
		),
		banner: bool(
			'Bandeau affiché',
			"Vrai quand ce bandeau est à l'antenne.",
			ON,
			[{ id: 'banner', type: 'dropdown', label: 'Bandeau', default: 'any', choices: [any, ...bannerChoices(config)] }],
			(s, o) => (o.banner === 'any' ? s.display.banner !== null : self.bannerNumber() === Number(o.banner)),
		),
		theme: bool(
			'Thème actif',
			"Vrai quand ce thème est celui de l'habillage.",
			ON,
			[{ id: 'theme', type: 'dropdown', label: 'Thème', default: 'tigre', choices: THEMES }],
			(s, o) => s.config.theme === o.theme,
		),
		phase: bool(
			'Phase du match',
			'Vrai pendant cette phase : chrono en marche, en pause, mi-temps…',
			ON,
			[{ id: 'phase', type: 'dropdown', label: 'Phase', default: 'running', choices: PHASES }],
			(s, o) => s.match.clock.phase === o.phase,
		),
		leading: bool(
			'Équipe qui mène',
			"Vrai quand cette équipe a plus de buts que l'autre.",
			ON,
			[{ id: 'team', type: 'dropdown', label: 'Équipe', default: 'home', choices: [...teamChoices(config), { id: 'draw', label: 'Égalité' }] }],
			(s, o) => {
				const { home, away } = s.match.score
				return o.team === 'draw' ? home === away : o.team === 'home' ? home > away : away > home
			},
		),
		shootout_next: bool(
			'Tirs au but : équipe qui doit tirer',
			"Vrai quand c'est à cette équipe de tirer.",
			ON,
			[{ id: 'team', type: 'dropdown', label: 'Équipe', default: 'home', choices: teamChoices(config) }],
			(s, o) => s.match.shootout?.next === o.team,
		),
		simulation: bool('Simulation en cours', 'Vrai quand un match de simulation est joué à la place du vrai.', ALERT, [], (s) => s.simulation),
	}
}
