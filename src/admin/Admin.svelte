<script lang="ts">
  import { onMount } from 'svelte';
  import { api, savedToken } from '../client/connection';
  import PinForm from '../client/PinForm.svelte';
  import { THEMES, TRIGGER_EVENTS } from '../shared/types';
  import type { Config, PrivateSettings, TeamId, TriggerEvent, VmixLogEntry, VmixTrigger } from '../shared/types';

  let config = $state<Config | null>(null);
  let settings = $state<PrivateSettings | null>(null);
  let vmixStatus = $state<{ ok: boolean; detail: string } | null>(null);
  let vmixLog = $state<VmixLogEntry[]>([]);
  let needPin = $state(!savedToken());
  let message = $state<{ text: string; ok: boolean } | null>(null);
  let saving = $state(false);
  // Dernière version enregistrée, pour signaler les changements pas encore envoyés.
  let saved = $state('');

  const teams: { id: TeamId; label: string }[] = [
    { id: 'home', label: 'Équipe 1 (à gauche)' },
    { id: 'away', label: 'Équipe 2 (à droite)' },
  ];
  const themeNames: Record<string, string> = { tigre: 'Tigre' };
  const dirty = $derived(config !== null && JSON.stringify({ config, settings }) !== saved);
  const events = Object.entries(TRIGGER_EVENTS) as [TriggerEvent, string][];
  const origin = location.origin;

  async function load() {
    const res = await api<{ config: Config; settings: PrivateSettings }>('/api/config');
    if (res.error !== undefined) {
      if (res.denied) needPin = true;
      else message = { text: res.error, ok: false };
      return;
    }
    config = res.config;
    settings = res.settings;
    saved = JSON.stringify({ config, settings });
    refreshLog();
  }

  async function checkVmix() {
    vmixStatus = { ok: false, detail: 'Vérification…' };
    const res = await api<{ ok: boolean; detail: string }>('/api/vmix/status');
    vmixStatus = res.error !== undefined ? { ok: false, detail: res.error } : res;
  }

  async function refreshLog() {
    const res = await api<{ log: VmixLogEntry[] }>('/api/vmix/log');
    if (res.error === undefined) vmixLog = res.log;
  }

  /** Envoie l'appel à vMix tout de suite, avec les valeurs à l'écran, même non enregistrées. */
  async function testTrigger(t: VmixTrigger) {
    const res = await api<VmixLogEntry>('/api/vmix/test', { function: t.function, input: t.input, value: t.value, duration: t.duration });
    message = res.error !== undefined ? { text: res.error, ok: false } : { text: res.ok ? 'vMix a accepté l\u2019appel.' : res.detail, ok: res.ok };
    refreshLog();
  }

  function addTrigger() {
    settings?.vmix.triggers.push({ id: `t${Date.now().toString(36)}`, on: 'goal', enabled: false, function: '', delayMs: 0 });
  }

  const time = (at: number) => new Date(at).toLocaleTimeString('fr-FR');

  onMount(() => {
    if (!needPin) load();
    // Prévient avant de quitter la page avec des changements non enregistrés.
    const warn = (ev: BeforeUnloadEvent) => dirty && ev.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  });

  async function save() {
    if (!config) return;
    saving = true;
    const res = await api<{ token: string }>('/api/config', { config, settings });
    saving = false;
    if (res.error !== undefined) {
      message = { text: res.error, ok: false };
      return;
    }
    saved = JSON.stringify({ config, settings });
    message = { text: 'Enregistré. Les écrans sont à jour.', ok: true };
    setTimeout(() => message?.ok && (message = null), 4000);
  }

  async function upload(team: TeamId, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file || !config) return;
    const data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const res = await api<{ path: string }>('/api/logo', { data });
    input.value = '';
    if (res.error !== undefined) message = { text: res.error, ok: false };
    else config.teams[team].logo = res.path;
  }

  function addPlayer(team: TeamId) {
    if (!config) return;
    const players = config.teams[team].players;
    const number = Math.max(0, ...players.map((p) => p.number)) + 1;
    players.push({ id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, number, name: '', starter: false });
  }
</script>

{#if needPin}
  <PinForm
    onok={() => {
      needPin = false;
      load();
    }}
  />
{:else if config && settings}
  <main>
    <header>
      <h1>Configuration</h1>
      <p>Tout s'applique en direct à l'enregistrement, sans redémarrer. Le match en cours n'est pas touché.</p>
    </header>

    <section>
      <h2>Événement</h2>
      <div class="grid">
        <label>Nom de l'événement<input bind:value={config.texts.title} maxlength="60" /></label>
        <label>Sous-titre<input bind:value={config.texts.subtitle} maxlength="80" /></label>
        <label>Message de l'écran d'attente<input bind:value={config.texts.holding} maxlength="60" /></label>
        <label>
          Thème
          <select bind:value={config.theme}>
            {#each THEMES as t (t)}<option value={t}>{themeNames[t] ?? t}</option>{/each}
          </select>
        </label>
      </div>
    </section>

    {#each teams as { id, label } (id)}
      {@const team = config.teams[id]}
      <section>
        <h2>{label}</h2>
        <div class="grid">
          <label>Nom<input bind:value={team.name} maxlength="30" /></label>
          <label>Sigle (4 lettres au plus)<input bind:value={team.code} maxlength="4" /></label>
          <label class="color">Couleur<span><input type="color" bind:value={team.color} /><input bind:value={team.color} maxlength="7" /></span></label>
          <div class="logo">
            <span class="swatch" style:background={team.logoOnLight ? '#f3eee4' : team.color}><img src={team.logo} alt="Logo actuel" /></span>
            <div>
              <label class="file">Changer le logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={(ev) => upload(id, ev.currentTarget)} /></label>
              <label class="check"><input type="checkbox" bind:checked={team.logoOnLight} /> Logo sombre : le poser sur un fond clair</label>
            </div>
          </div>
        </div>

        <h3>Joueurs</h3>
        <div class="players">
          <div class="row head"><span>N°</span><span>Nom</span><span>Titulaire</span><span></span></div>
          {#each team.players as p, i (p.id)}
            <div class="row">
              <input type="number" min="0" max="999" bind:value={p.number} aria-label="Numéro" />
              <input bind:value={p.name} maxlength="40" placeholder="Nom du joueur" aria-label="Nom" />
              <input type="checkbox" bind:checked={p.starter} aria-label="Titulaire" />
              <button class="ghost" onclick={() => team.players.splice(i, 1)} aria-label="Retirer {p.name || 'ce joueur'}">Retirer</button>
            </div>
          {/each}
        </div>
        <button onclick={() => addPlayer(id)}>Ajouter un joueur</button>
        <p class="hint">{team.players.filter((p) => p.starter).length} titulaires, {team.players.filter((p) => !p.starter).length} remplaçants.</p>
      </section>
    {/each}

    <section>
      <h2>Format du match</h2>
      <div class="grid">
        <label>Nombre de périodes<input type="number" min="1" max="4" bind:value={config.format.periods} /></label>
        <label>Durée d'une période (minutes)<input type="number" min="1" max="90" bind:value={config.format.periodMinutes} /></label>
        <label class="check"><input type="checkbox" bind:checked={config.format.extraTime.enabled} /> Prolongations en cas d'égalité</label>
        <label>Durée d'une prolongation (minutes)<input type="number" min="1" max="30" bind:value={config.format.extraTime.periodMinutes} disabled={!config.format.extraTime.enabled} /></label>
        <label class="check"><input type="checkbox" bind:checked={config.format.shootout.enabled} /> Tirs au but en cas d'égalité</label>
        <label>Tirs par équipe avant la mort subite<input type="number" min="1" max="10" bind:value={config.format.shootout.kicks} disabled={!config.format.shootout.enabled} /></label>
      </div>
      <p class="hint">Changer le format pendant un match recalcule le chrono et les minutes déjà saisies.</p>
    </section>

    <section>
      <h2>Bandeaux enregistrés</h2>
      <p class="hint">Ils apparaissent dans le contrôle, à lancer d'un appui. Un lien affiche un QR code sur le bandeau.</p>
      {#each config.banners as b, i (i)}
        <div class="banner">
          <input bind:value={b.title} maxlength="80" placeholder="Titre" aria-label="Titre" />
          <input bind:value={b.subtitle} maxlength="120" placeholder="Sous-titre (facultatif)" aria-label="Sous-titre" />
          <input bind:value={b.qr} maxlength="300" placeholder="Lien pour QR code (facultatif)" aria-label="Lien" />
          <button class="ghost" onclick={() => config?.banners.splice(i, 1)}>Retirer</button>
        </div>
      {/each}
      <button onclick={() => config?.banners.push({ title: '' })}>Ajouter un bandeau</button>
    </section>

    <section>
      <h2>vMix</h2>
      <p class="hint">
        Quand un événement de match arrive, l'app peut appeler une fonction de vMix. Si vMix ne répond pas, l'habillage s'affiche quand même.
        Rien ne part pendant une simulation.
      </p>
      <div class="grid">
        <label class="check"><input type="checkbox" bind:checked={settings.vmix.enabled} /> Activer les déclencheurs pendant le match</label>
        <label>Adresse du contrôleur web de vMix<input bind:value={settings.vmix.host} maxlength="100" /></label>
        <div class="status">
          <button onclick={checkVmix}>Vérifier la connexion</button>
          {#if vmixStatus}<span class:ok={vmixStatus.ok}>{vmixStatus.detail}</span>{/if}
        </div>
      </div>

      <h3>Déclencheurs</h3>
      {#each settings.vmix.triggers as t, i (t.id)}
        <div class="trigger">
          <label class="check"><input type="checkbox" bind:checked={t.enabled} /> Actif</label>
          <label>
            Quand
            <select bind:value={t.on}>
              {#each events as [id, label] (id)}<option value={id}>{label}</option>{/each}
            </select>
          </label>
          <label>Fonction vMix<input bind:value={t.function} maxlength="60" placeholder="OverlayInput2In" /></label>
          <label>Input<input bind:value={t.input} maxlength="120" placeholder="nom ou numéro" /></label>
          <label>Value<input bind:value={t.value} maxlength="120" /></label>
          <label>Duration<input bind:value={t.duration} maxlength="120" /></label>
          <label>Délai (ms)<input type="number" min="0" max="60000" step="100" bind:value={t.delayMs} /></label>
          <div class="actions">
            <button onclick={() => testTrigger(t)} disabled={!t.function}>Tester</button>
            <button class="ghost" onclick={() => settings?.vmix.triggers.splice(i, 1)}>Retirer</button>
          </div>
        </div>
      {/each}
      <button onclick={addTrigger}>Ajouter un déclencheur</button>
      <p class="hint">« Tester » envoie l'appel tout de suite, même si les déclencheurs sont désactivés. Les trois lignes fournies sont des exemples à adapter.</p>

      {#if vmixLog.length}
        <h3>Derniers appels</h3>
        <ul class="log">
          {#each vmixLog.slice(0, 8) as entry (entry.at + entry.url)}
            <li class:ok={entry.ok}><b>{time(entry.at)}</b> {entry.url.split('/api/?')[1] ?? entry.url} — {entry.detail}</li>
          {/each}
        </ul>
      {/if}
    </section>

    <section>
      <h2>Companion et Stream Deck</h2>
      <p class="hint">
        Des adresses simples pour piloter l'affichage depuis Bitfocus Companion (action « HTTP GET ») ou tout autre outil. Les buts et les cartons restent sur la page de contrôle.
      </p>
      <div class="grid">
        <label>Clé<input bind:value={settings.apiKey} maxlength="64" /></label>
      </div>
      <ul class="urls">
        <li><code>{origin}/api/do/score/toggle?key={settings.apiKey}</code> afficher ou masquer le score (aussi <code>show</code>, <code>hide</code>)</li>
        <li><code>{origin}/api/do/banner/1?key={settings.apiKey}</code> lancer ou retirer le premier bandeau enregistré (<code>2</code>, <code>3</code>… ou <code>off</code>)</li>
        <li><code>{origin}/api/do/panel/summary?key={settings.apiKey}</code> afficher un panneau : <code>prematch</code>, <code>lineup-home</code>, <code>lineup-away</code>, <code>summary</code>, <code>stats</code>, <code>holding</code>, ou <code>off</code></li>
        <li><code>{origin}/api/do/theme/tigre?key={settings.apiKey}</code> changer de thème</li>
      </ul>
      <p class="hint">Depuis un autre appareil que ce PC, remplace <code>localhost</code> par l'adresse du PC sur le réseau.</p>
    </section>

    <section>
      <h2>Code PIN</h2>
      <div class="grid">
        <label>Code du contrôle (4 à 8 chiffres)<input bind:value={settings.pin} inputmode="numeric" maxlength="8" /></label>
      </div>
      <p class="hint">Le changer déconnecte tous les téléphones : ils devront saisir le nouveau code.</p>
    </section>
  </main>

  <footer>
    {#if message}<span class:ok={message.ok} role="status">{message.text}</span>{:else if dirty}<span>Changements non enregistrés.</span>{:else}<span></span>{/if}
    <button class="primary" onclick={save} disabled={saving || !dirty}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
  </footer>
{:else}
  <p class="loading">{message?.text ?? 'Chargement…'}</p>
{/if}

<style>
  :global(html) {
    background: #0c0c0d;
    color: #edeae4;
    font: 15px/1.45 system-ui, sans-serif;
  }
  :global(body) {
    margin: 0;
  }
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 20px 120px;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 26px;
  }
  header p,
  .hint {
    color: #9b978f;
    margin: 0 0 8px;
    font-size: 14px;
  }
  section {
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid #2e2e31;
  }
  h2 {
    margin: 0 0 14px;
    font-size: 18px;
  }
  h3 {
    margin: 22px 0 8px;
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #9b978f;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px 18px;
    align-items: end;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 13px;
    color: #c9c3b6;
  }
  input,
  select {
    font: inherit;
    font-size: 15px;
    color: #edeae4;
    background: #1b1b1d;
    border: 1px solid #2e2e31;
    border-radius: 6px;
    padding: 9px 10px;
    min-width: 0;
  }
  input:disabled {
    opacity: 0.4;
  }
  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: #ef5407;
  }
  .check {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 9px 0;
  }
  .color span {
    display: grid;
    grid-template-columns: 46px 1fr;
    gap: 8px;
  }
  .color input[type='color'] {
    padding: 2px;
    height: 40px;
  }
  .logo {
    display: flex;
    gap: 14px;
    align-items: center;
    grid-column: 1 / -1;
  }
  .swatch {
    width: 84px;
    height: 84px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    flex: none;
  }
  .swatch img {
    max-width: 70%;
    max-height: 70%;
  }
  .file input {
    padding: 6px;
  }
  .players {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }
  .row {
    display: grid;
    grid-template-columns: 76px 1fr 76px 90px;
    gap: 8px;
    align-items: center;
  }
  .row.head {
    font-size: 12px;
    color: #9b978f;
  }
  .row input[type='checkbox'] {
    justify-self: center;
  }
  .banner {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 90px;
    gap: 8px;
    margin-bottom: 8px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .status span,
  .log li {
    color: #ff9d6b;
  }
  .status span.ok,
  .log li.ok {
    color: #23d17a;
  }
  .trigger {
    display: grid;
    grid-template-columns: 80px 1.4fr 1.2fr 1fr 0.7fr 0.7fr 0.7fr auto;
    gap: 8px;
    align-items: end;
    padding: 10px 0;
    border-bottom: 1px solid #1f1f22;
  }
  .trigger .actions {
    display: flex;
    gap: 4px;
  }
  .log,
  .urls {
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .urls li {
    color: #9b978f;
  }
  code {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 12px;
    color: #edeae4;
    background: #1b1b1d;
    padding: 2px 5px;
    border-radius: 4px;
    word-break: break-all;
  }
  @media (max-width: 900px) {
    .trigger {
      grid-template-columns: 1fr 1fr;
    }
  }
  button {
    font: inherit;
    font-weight: 700;
    color: inherit;
    background: #1b1b1d;
    border: 1px solid #2e2e31;
    border-radius: 6px;
    padding: 9px 14px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .ghost {
    background: none;
    color: #9b978f;
    font-weight: 500;
    padding: 9px 6px;
  }
  .primary {
    background: #ef5407;
    border-color: #ef5407;
    color: #0a0a0a;
    padding: 12px 26px;
  }
  footer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
    background: #151517;
    border-top: 1px solid #2e2e31;
  }
  footer span {
    color: #ff9d6b;
    font-weight: 600;
  }
  footer span.ok {
    color: #23d17a;
  }
  .loading {
    text-align: center;
    margin-top: 40vh;
    color: #9b978f;
  }
  @media (max-width: 640px) {
    .banner {
      grid-template-columns: 1fr;
    }
    .row {
      grid-template-columns: 60px 1fr 40px 70px;
    }
  }
</style>
