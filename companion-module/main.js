import { InstanceBase, InstanceStatus, Regex, runEntrypoint } from '@companion-module/base'
import { buildActions } from './actions.js'
import { buildFeedbacks } from './feedbacks.js'
import { buildPresets } from './presets.js'
import { variableDefinitions, variableValues } from './variables.js'

const RETRY_MS = 2000
const TICK_MS = 250
const TIMEOUT_MS = 3000

class MatchdayInstance extends InstanceBase {
	/** Dernier état reçu de matchday-overlay, ou null tant qu'on n'a rien reçu. */
	state = null
	/** Écart entre l'horloge du serveur et celle de Companion, pour un chrono juste même sur deux PC. */
	clockOffset = 0
	connected = false
	keyOk = true
	sent = {}
	shape = ''

	async init(config) {
		this.config = config
		this.setVariableDefinitions(variableDefinitions())
		this.define()
		this.publish()
		this.ticker = setInterval(() => this.publish(), TICK_MS)
		this.connect()
	}

	async configUpdated(config) {
		this.config = config
		this.connect()
	}

	async destroy() {
		clearInterval(this.ticker)
		clearTimeout(this.retry)
		const socket = this.socket
		this.socket = null
		socket?.close()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'matchday-overlay',
				value: "L'adresse du PC qui fait tourner l'habillage, et la clé affichée dans sa page d'admin (section « Companion et Stream Deck »).",
			},
			{ type: 'textinput', id: 'host', label: 'Adresse', width: 6, default: '127.0.0.1', regex: Regex.HOSTNAME },
			{ type: 'number', id: 'port', label: 'Port', width: 3, default: 4455, min: 1, max: 65535 },
			{ type: 'textinput', id: 'key', label: 'Clé', width: 9, default: '' },
		]
	}

	get origin() {
		return `${this.config.host || '127.0.0.1'}:${this.config.port || 4455}`
	}

	url(path) {
		return `http://${this.origin}${path}?key=${encodeURIComponent(this.config.key ?? '')}`
	}

	// ---- connexion ----

	connect() {
		clearTimeout(this.retry)
		const previous = this.socket
		this.socket = null
		previous?.close()
		this.connected = false
		this.updateStatus(InstanceStatus.Connecting)

		let socket
		try {
			socket = new WebSocket(`ws://${this.origin}/ws`)
		} catch {
			return this.updateStatus(InstanceStatus.BadConfig, 'Adresse invalide.')
		}
		this.socket = socket
		socket.addEventListener('open', () => {
			if (this.socket !== socket) return
			this.connected = true
			void this.checkKey()
		})
		socket.addEventListener('message', (event) => {
			if (this.socket !== socket) return
			let message
			try {
				message = JSON.parse(String(event.data))
			} catch {
				return
			}
			if (message?.type === 'snapshot') this.receive(message)
		})
		// Une ancienne connexion qui se ferme ne doit rien toucher : seule la connexion en cours relance.
		socket.addEventListener('close', () => {
			if (this.socket !== socket) return
			this.connected = false
			this.publish()
			this.updateStatus(InstanceStatus.ConnectionFailure, `matchday-overlay ne répond pas sur ${this.origin}.`)
			this.retry = setTimeout(() => this.connect(), RETRY_MS)
		})
		socket.addEventListener('error', () => {})
	}

	/** Une commande inconnue est refusée avec 400 si la clé est bonne, 401 sinon : de quoi vérifier la clé sans rien toucher. */
	async checkKey() {
		try {
			const res = await fetch(this.url('/api/command'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{"type":"ping"}',
				signal: AbortSignal.timeout(TIMEOUT_MS),
			})
			if (res.status === 404) return this.updateStatus(InstanceStatus.BadConfig, 'Cette version de matchday-overlay est trop ancienne pour le module.')
			this.keyOk = res.status !== 401
		} catch {
			return
		}
		if (this.connected) this.showStatus()
	}

	showStatus() {
		if (this.keyOk) this.updateStatus(InstanceStatus.Ok)
		else this.updateStatus(InstanceStatus.BadConfig, "Clé incorrecte : copie celle de la page d'admin de matchday-overlay.")
	}

	receive(snapshot) {
		this.state = snapshot
		this.clockOffset = snapshot.serverNow - Date.now()
		// Les menus et les boutons tout faits reprennent les équipes, les joueurs et les bandeaux : on les refait s'ils changent.
		const shape = JSON.stringify([snapshot.config.teams, snapshot.config.banners.map((b) => b.title)])
		if (shape !== this.shape) {
			this.shape = shape
			this.define()
		}
		this.publish()
		this.checkFeedbacks()
	}

	define() {
		this.setActionDefinitions(buildActions(this))
		this.setFeedbackDefinitions(buildFeedbacks(this))
		this.setPresetDefinitions(buildPresets(this))
	}

	/** N'envoie à Companion que les variables qui ont changé : le chrono est recalculé quatre fois par seconde. */
	publish() {
		const values = variableValues(this.state, this.connected, Date.now() + this.clockOffset)
		const changed = {}
		for (const [key, value] of Object.entries(values)) if (this.sent[key] !== value) changed[key] = this.sent[key] = value
		if (Object.keys(changed).length) this.setVariableValues(changed)
	}

	/** Numéro du bandeau enregistré qui est à l'antenne, ou 0. */
	bannerNumber() {
		const shown = this.state?.display.banner
		if (!shown) return 0
		const same = (b) => b.title === shown.title && (b.subtitle ?? '') === (shown.subtitle ?? '') && (b.qr ?? '') === (shown.qr ?? '')
		return this.state.config.banners.findIndex(same) + 1
	}

	// ---- envoi ----

	command(body) {
		return this.request('POST', '/api/command', body)
	}

	async request(method, path, body) {
		let res
		try {
			res = await fetch(this.url(path), {
				method,
				headers: body ? { 'content-type': 'application/json' } : undefined,
				body: body ? JSON.stringify(body) : undefined,
				signal: AbortSignal.timeout(TIMEOUT_MS),
			})
		} catch {
			return this.log('error', `matchday-overlay ne répond pas sur ${this.origin}.`)
		}
		const answer = await res.json().catch(() => null)
		if (res.status === 401) {
			this.keyOk = false
			this.showStatus()
		}
		// Un refus du match (« Le chrono ne tourne pas. ») n'est pas une panne : on le note, c'est tout.
		if (!answer?.ok) this.log('warn', answer?.reason ?? `Réponse ${res.status}.`)
	}
}

runEntrypoint(MatchdayInstance, [])
