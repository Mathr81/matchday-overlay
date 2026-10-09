// Listes proposées dans les actions et les retours d'état.

export const TEAMS = [
	{ id: 'home', label: 'Équipe 1' },
	{ id: 'away', label: 'Équipe 2' },
]

export const PANELS = [
	{ id: 'prematch', label: 'Avant-match' },
	{ id: 'lineup-home', label: 'Composition équipe 1' },
	{ id: 'lineup-away', label: 'Composition équipe 2' },
	{ id: 'summary', label: 'Résumé (mi-temps, fin du match)' },
	{ id: 'stats', label: 'Statistiques' },
	{ id: 'holding', label: "Écran d'attente" },
	{ id: 'shootout', label: 'Tirs au but' },
]

export const THEMES = [
	{ id: 'tigre', label: 'Tigre' },
	{ id: 'regie', label: 'Régie' },
	{ id: 'clair', label: 'Clair' },
]

export const STATS = [
	{ id: 'shots', label: 'Tirs' },
	{ id: 'onTarget', label: 'Tirs cadrés' },
	{ id: 'corners', label: 'Corners' },
	{ id: 'fouls', label: 'Fautes' },
	{ id: 'offsides', label: 'Hors-jeu' },
]

export const PHASES = [
	{ id: 'pre', label: "Avant le coup d'envoi" },
	{ id: 'running', label: 'Chrono en marche' },
	{ id: 'paused', label: 'Chrono en pause' },
	{ id: 'break', label: 'Entre deux périodes' },
	{ id: 'shootout', label: 'Tirs au but' },
	{ id: 'ended', label: 'Match terminé' },
]

/** Panneau de l'état du match → identifiant de la liste ci-dessus. */
export const panelId = (panel) => (!panel ? null : panel.type === 'lineup' ? `lineup-${panel.team}` : panel.type)

/** Identifiant de la liste → panneau à envoyer. */
export const panelFor = (id) => (id.startsWith('lineup-') ? { type: 'lineup', team: id.slice(7) } : { type: id })

/** Équipes avec leur vrai nom dès que le match est reçu. */
export const teamChoices = (config) => TEAMS.map((t) => ({ id: t.id, label: config ? `${t.label} : ${config.teams[t.id].name}` : t.label }))

export const playerChoices = (config, team) => [
	{ id: '', label: 'Sans nom' },
	...(config?.teams[team].players ?? []).map((p) => ({ id: p.id, label: `${p.number}  ${p.name}` })),
]

export const bannerChoices = (config) =>
	config?.banners.length ? config.banners.map((b, i) => ({ id: i + 1, label: `${i + 1}. ${b.title}` })) : [1, 2, 3, 4, 5, 6].map((n) => ({ id: n, label: `Bandeau ${n}` }))
