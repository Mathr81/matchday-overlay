import { bannerChoices, panelFor, panelId, PANELS, playerChoices, STATS, teamChoices, THEMES } from './choices.js'

export function buildActions(self) {
	const config = self.state?.config
	const teams = teamChoices(config)
	const team = { id: 'team', type: 'dropdown', label: 'Équipe', default: 'home', choices: teams }
	// Un seul des deux menus de joueurs s'affiche, selon l'équipe choisie.
	const players = (label) => [
		{ id: 'player_home', type: 'dropdown', label, default: '', choices: playerChoices(config, 'home'), isVisible: (o) => o.team === 'home' },
		{ id: 'player_away', type: 'dropdown', label, default: '', choices: playerChoices(config, 'away'), isVisible: (o) => o.team === 'away' },
	]
	const player = (o) => o[`player_${o.team}`] || undefined
	const send = (body) => self.command(body)
	const display = () => self.state?.display

	return {
		// ---- affichage ----
		score_visible: {
			name: 'Score : afficher ou masquer',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Action',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Basculer' },
						{ id: 'show', label: 'Afficher' },
						{ id: 'hide', label: 'Masquer' },
					],
				},
			],
			callback: ({ options: o }) => send({ type: 'set_score_visible', visible: o.mode === 'toggle' ? !display()?.scoreVisible : o.mode === 'show' }),
		},
		panel: {
			name: 'Panneau : afficher',
			options: [
				{ id: 'panel', type: 'dropdown', label: 'Panneau', default: 'summary', choices: PANELS },
				{ id: 'toggle', type: 'checkbox', label: 'Un deuxième appui le retire', default: true },
			],
			callback: ({ options: o }) => send({ type: 'set_panel', panel: o.toggle && panelId(display()?.panel) === o.panel ? null : panelFor(o.panel) }),
		},
		panel_off: { name: 'Panneau : retirer', options: [], callback: () => send({ type: 'set_panel', panel: null }) },
		banner: {
			name: 'Bandeau enregistré : lancer',
			options: [
				{ id: 'banner', type: 'dropdown', label: 'Bandeau', default: 1, choices: bannerChoices(config) },
				{ id: 'toggle', type: 'checkbox', label: 'Un deuxième appui le retire', default: true },
			],
			callback: ({ options: o }) => {
				const banner = self.state?.config.banners[Number(o.banner) - 1]
				if (!banner) return self.log('warn', `Le bandeau ${o.banner} n'existe pas dans la configuration.`)
				return send({ type: 'set_banner', banner: o.toggle && self.bannerNumber() === Number(o.banner) ? null : banner })
			},
		},
		banner_custom: {
			name: 'Bandeau libre : lancer',
			options: [
				{ id: 'title', type: 'textinput', label: 'Titre', default: '', useVariables: true },
				{ id: 'subtitle', type: 'textinput', label: 'Sous-titre', default: '', useVariables: true },
				{ id: 'qr', type: 'textinput', label: 'Lien pour le QR code (facultatif)', default: '' },
			],
			callback: async ({ options: o }, context) => {
				const title = await context.parseVariablesInString(o.title)
				const subtitle = await context.parseVariablesInString(o.subtitle)
				return send({ type: 'set_banner', banner: { title, subtitle: subtitle || undefined, qr: o.qr || undefined } })
			},
		},
		banner_off: { name: 'Bandeau : retirer', options: [], callback: () => send({ type: 'set_banner', banner: null }) },
		theme: {
			name: 'Thème : changer',
			options: [{ id: 'theme', type: 'dropdown', label: 'Thème', default: 'tigre', choices: THEMES }],
			callback: ({ options: o }) => self.request('GET', `/api/do/theme/${o.theme}`),
		},

		// ---- chrono ----
		clock_start: { name: "Chrono : coup d'envoi de la période suivante", options: [], callback: () => send({ type: 'start_period' }) },
		clock_pause: { name: 'Chrono : pause', options: [], callback: () => send({ type: 'pause_clock' }) },
		clock_resume: { name: 'Chrono : reprise', options: [], callback: () => send({ type: 'resume_clock' }) },
		clock_toggle: {
			name: 'Chrono : pause ou reprise',
			options: [],
			callback: () => send({ type: self.state?.match.clock.phase === 'paused' ? 'resume_clock' : 'pause_clock' }),
		},
		clock_end_period: { name: 'Chrono : fin de la période', options: [], callback: () => send({ type: 'end_period' }) },
		added_time: {
			name: 'Temps additionnel : annoncer',
			options: [{ id: 'minutes', type: 'number', label: 'Minutes (0 pour le retirer)', default: 3, min: 0, max: 30 }],
			callback: ({ options: o }) => send({ type: 'set_added_time', minutes: Number(o.minutes) }),
		},

		// ---- match ----
		goal: {
			name: 'But',
			options: [
				team,
				{
					id: 'kind',
					type: 'dropdown',
					label: 'Type',
					default: 'normal',
					choices: [
						{ id: 'normal', label: 'But' },
						{ id: 'penalty', label: 'Sur penalty' },
						{ id: 'own', label: "Contre son camp (le point va à l'équipe choisie)" },
					],
				},
				...players('Buteur'),
				{ id: 'silent', type: 'checkbox', label: 'Correction du score, sans animation', default: false },
			],
			callback: ({ options: o }) =>
				// Contre son camp, le buteur joue dans l'autre équipe : on ne l'envoie pas d'ici.
				send({ type: 'goal', team: o.team, kind: o.kind, scorer: o.kind === 'own' ? undefined : player(o), silent: o.silent || undefined }),
		},
		card: {
			name: 'Carton',
			options: [
				team,
				{
					id: 'color',
					type: 'dropdown',
					label: 'Couleur',
					default: 'yellow',
					choices: [
						{ id: 'yellow', label: 'Jaune' },
						{ id: 'red', label: 'Rouge' },
					],
				},
				...players('Joueur'),
			],
			callback: ({ options: o }) => send({ type: 'card', team: o.team, color: o.color, player: player(o) }),
		},
		penalty: { name: 'Penalty : annoncer', options: [team], callback: ({ options: o }) => send({ type: 'penalty', team: o.team }) },
		penalty_missed: {
			name: 'Penalty : raté',
			options: [team, ...players('Tireur')],
			callback: ({ options: o }) => send({ type: 'penalty_missed', team: o.team, player: player(o) }),
		},
		stat: {
			name: 'Stat : compter',
			options: [
				team,
				{ id: 'key', type: 'dropdown', label: 'Compteur', default: 'shots', choices: STATS },
				{
					id: 'delta',
					type: 'dropdown',
					label: 'Sens',
					default: 1,
					choices: [
						{ id: 1, label: '+1' },
						{ id: -1, label: '−1 (correction)' },
					],
				},
			],
			callback: ({ options: o }) => send({ type: 'stat', team: o.team, key: o.key, delta: Number(o.delta) }),
		},
		end_match: { name: 'Match : terminer', options: [], callback: () => send({ type: 'end_match' }) },
		announce_winner: { name: 'Match : annoncer le vainqueur', options: [], callback: () => send({ type: 'announce_winner' }) },

		// ---- tirs au but ----
		shootout_start: {
			name: 'Tirs au but : commencer la séance',
			options: [{ id: 'team', type: 'dropdown', label: 'Équipe qui tire en premier', default: 'home', choices: teams }],
			callback: ({ options: o }) => send({ type: 'start_shootout', first: o.team }),
		},
		shootout_kick: {
			name: "Tirs au but : tir de l'équipe dont c'est le tour",
			options: [
				{
					id: 'scored',
					type: 'dropdown',
					label: 'Résultat',
					default: 'yes',
					choices: [
						{ id: 'yes', label: 'Marqué' },
						{ id: 'no', label: 'Raté' },
					],
				},
			],
			callback: ({ options: o }) => {
				const next = self.state?.match.shootout?.next
				if (!next) return self.log('warn', 'Pas de tir au but attendu en ce moment.')
				return send({ type: 'shootout_kick', team: next, scored: o.scored === 'yes' })
			},
		},
	}
}
