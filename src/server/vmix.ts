import type { TriggerEvent, VmixLogEntry, VmixSettings, VmixTrigger } from '../shared/types';

const TIMEOUT_MS = 2000;
const LOG_SIZE = 50;

/** Adresse de l'API HTTP de vMix pour un déclencheur : /api/?Function=…&Input=…&Value=…&Duration=… */
export function vmixUrl(host: string, trigger: Pick<VmixTrigger, 'function' | 'input' | 'value' | 'duration'>): string {
  const params: [string, string | undefined][] = [
    ['Function', trigger.function],
    ['Input', trigger.input],
    ['Value', trigger.value],
    ['Duration', trigger.duration],
  ];
  const query = params
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return `${host.replace(/\/+$/, '')}/api/?${query}`;
}

/**
 * Envoie à vMix les appels prévus pour les événements du match.
 * Un échec est noté dans le journal et ne remonte jamais : l'habillage ne dépend pas de vMix.
 */
export class VmixBridge {
  readonly log: VmixLogEntry[] = [];

  constructor(
    private readonly settings: () => VmixSettings,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  /** À appeler quand des événements de match se produisent. */
  fire(events: TriggerEvent[]): void {
    const settings = this.settings();
    if (!settings.enabled) return;
    for (const trigger of settings.triggers) {
      if (!trigger.enabled || !events.includes(trigger.on)) continue;
      if (trigger.delayMs > 0) setTimeout(() => void this.call(trigger), trigger.delayMs);
      else void this.call(trigger);
    }
  }

  /** Envoie un appel tout de suite, même si l'interrupteur général est coupé (bouton « Tester »). */
  async call(trigger: Pick<VmixTrigger, 'function' | 'input' | 'value' | 'duration'>): Promise<VmixLogEntry> {
    const url = vmixUrl(this.settings().host, trigger);
    const entry: VmixLogEntry = { at: this.now(), url, ok: false, detail: '' };
    try {
      const res = await this.fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      entry.ok = res.ok;
      entry.detail = res.ok ? 'OK' : `vMix a répondu ${res.status} : ${(await res.text()).slice(0, 120)}`;
    } catch (e) {
      entry.detail = e instanceof Error && e.name === 'TimeoutError' ? 'vMix ne répond pas (délai dépassé).' : 'vMix est injoignable à cette adresse.';
    }
    this.log.unshift(entry);
    this.log.length = Math.min(this.log.length, LOG_SIZE);
    return entry;
  }

  /** vMix répond-il à l'adresse configurée ? */
  async status(): Promise<{ ok: boolean; detail: string }> {
    const url = `${this.settings().host.replace(/\/+$/, '')}/api`;
    try {
      const res = await this.fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return { ok: false, detail: `Réponse ${res.status}.` };
      const version = /<version>([^<]+)<\/version>/.exec(await res.text())?.[1];
      return { ok: true, detail: version ? `vMix ${version}` : 'Connecté.' };
    } catch {
      return { ok: false, detail: 'Injoignable. vMix est-il lancé, avec le contrôleur web activé (Réglages → Web Controller) ?' };
    }
  }
}
