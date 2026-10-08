<script lang="ts">
  import { onMount } from 'svelte';
  import { connect, type Connection } from '../client/connection';
  import { formatClock, isSentOff, periodLabel } from '../shared/clock';
  import type { CommandBody, GoalKind, Snapshot, TeamId } from '../shared/types';

  type Sheet =
    | { kind: 'goal'; team: TeamId; goal: GoalKind; scorer?: string; step: 'scorer' | 'assist' }
    | { kind: 'card'; team: TeamId; color: 'yellow' | 'red' }
    | { kind: 'sub'; team: TeamId; out?: string; step: 'out' | 'in' }
    | { kind: 'penalty'; team: TeamId }
    | { kind: 'missed'; team: TeamId };

  let snapshot = $state<Snapshot | null>(null);
  let offset = 0;
  let online = $state(false);
  let clockText = $state('00:00');
  let error = $state('');
  let sheet = $state<Sheet | null>(null);
  let connection: Connection;
  let errorTimer: ReturnType<typeof setTimeout>;

  const phase = $derived(snapshot?.match.clock.phase ?? 'pre');
  const playing = $derived(phase === 'running' || phase === 'paused');
  const added = $derived(snapshot?.match.clock.addedMinutes ?? 0);
  const teams: TeamId[] = ['home', 'away'];
  const other = (team: TeamId): TeamId => (team === 'home' ? 'away' : 'home');

  onMount(() => {
    connection = connect('control', {
      onSnapshot: (s, o) => {
        snapshot = s;
        offset = o;
      },
      onStatus: (o) => (online = o),
    });
    const id = setInterval(() => {
      if (snapshot) clockText = formatClock(snapshot.match.clock, snapshot.config.format, Date.now() + offset);
    }, 200);
    return () => {
      clearInterval(id);
      connection.close();
    };
  });

  async function send(body: CommandBody) {
    sheet = null;
    navigator.vibrate?.(15);
    const ack = await connection.send(body);
    if (ack.ok) return;
    error = ack.reason ?? 'Commande refusée.';
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => (error = ''), 4000);
  }

  function reset() {
    if (confirm('Démarrer un nouveau match ? Le match en cours sera archivé.')) send({ type: 'reset_match' });
  }

  // Équipe dont on choisit un joueur : pour un csc, le buteur est dans l'équipe adverse.
  const pickTeam = (s: Sheet): TeamId => (s.kind === 'goal' && s.goal === 'own' && s.step === 'scorer' ? other(s.team) : s.team);

  const sheetTitle = (s: Sheet): string => {
    if (s.kind === 'goal') return s.step === 'assist' ? 'Passeur ?' : 'Buteur ?';
    if (s.kind === 'card') return s.color === 'yellow' ? 'Carton jaune pour…' : 'Carton rouge pour…';
    if (s.kind === 'sub') return s.step === 'out' ? 'Qui sort ?' : 'Qui entre ?';
    if (s.kind === 'missed') return 'Penalty raté par…';
    return 'Penalty';
  };

  /** Un joueur a été touché, ou « sans nom » (id indéfini). */
  function pick(id?: string) {
    const s = sheet;
    if (!s) return;
    if (s.kind === 'goal') {
      if (s.step === 'scorer' && id && s.goal === 'normal') sheet = { ...s, scorer: id, step: 'assist' };
      else if (s.step === 'scorer') send({ type: 'goal', team: s.team, kind: s.goal, scorer: id });
      else send({ type: 'goal', team: s.team, kind: s.goal, scorer: s.scorer, assist: id });
    } else if (s.kind === 'card') send({ type: 'card', team: s.team, color: s.color, player: id });
    else if (s.kind === 'missed') send({ type: 'penalty_missed', team: s.team, player: id });
    else if (s.kind === 'sub') {
      if (s.step === 'out' && id) sheet = { ...s, out: id, step: 'in' };
      else send({ type: 'substitution', team: s.team, out: s.out, in: id });
    }
  }
</script>

{#if snapshot}
  {@const { config, match, display } = snapshot}
  <main>
    <header>
      {#if snapshot.simulation}<div class="sim">Simulation — le vrai match n'est pas touché</div>{/if}
      <div class="status" class:off={!online}>{online ? 'Connecté' : 'Hors ligne — reconnexion…'}</div>
      <div class="score">
        <span class="code">{config.teams.home.code}</span>
        <b>{match.score.home}</b><i>–</i><b>{match.score.away}</b>
        <span class="code">{config.teams.away.code}</span>
      </div>
      <div class="clock">
        <b>{clockText}</b>
        <span>{periodLabel(match.clock, config.format)}{phase === 'paused' ? ' · en pause' : ''}</span>
      </div>
    </header>

    <section class="teams">
      {#each teams as team (team)}
        <div class="team">
          <button class="goal" style:background={config.teams[team].color} onclick={() => (sheet = { kind: 'goal', team, goal: 'normal', step: 'scorer' })}>
            <small>But</small>{config.teams[team].name}
          </button>
          <div class="pair">
            <button class="yellow" onclick={() => (sheet = { kind: 'card', team, color: 'yellow' })}>Jaune</button>
            <button class="red" onclick={() => (sheet = { kind: 'card', team, color: 'red' })}>Rouge</button>
          </div>
          <button onclick={() => (sheet = { kind: 'sub', team, step: 'out' })}>Remplacement</button>
          <button onclick={() => (sheet = { kind: 'penalty', team })}>Penalty</button>
        </div>
      {/each}
    </section>

    <div class="pair">
      <button class="ghost" disabled={!match.lastGoalId} onclick={() => match.lastGoalId && send({ type: 'disallow_goal', target: match.lastGoalId })}>
        Refuser le dernier but
      </button>
      <button class="ghost" disabled={!match.lastGoalId} onclick={() => match.lastGoalId && send({ type: 'void_event', target: match.lastGoalId })}>
        Corriger sans annonce
      </button>
    </div>

    <section class="block">
      <h2>Chrono</h2>
      {#if phase === 'pre' || phase === 'break'}
        <button class="primary" onclick={() => send({ type: 'start_period' })}>
          {phase === 'pre' ? "Coup d'envoi" : 'Lancer la période suivante'}
        </button>
      {:else if playing}
        <div class="pair">
          {#if phase === 'running'}
            <button onclick={() => send({ type: 'pause_clock' })}>Pause</button>
          {:else}
            <button class="primary" onclick={() => send({ type: 'resume_clock' })}>Reprendre</button>
          {/if}
          <button onclick={() => send({ type: 'end_period' })}>Fin de période</button>
        </div>
        <div class="stepper">
          <span>Temps additionnel</span>
          <button disabled={added <= 0} onclick={() => send({ type: 'set_added_time', minutes: added - 1 })}>−</button>
          <b>+{added}</b>
          <button onclick={() => send({ type: 'set_added_time', minutes: added + 1 })}>+</button>
        </div>
      {:else}
        <p class="done">Match terminé.</p>
      {/if}
    </section>

    <section class="block">
      <h2>Antenne</h2>
      <button class:primary={!display.scoreVisible} onclick={() => send({ type: 'set_score_visible', visible: !display.scoreVisible })}>
        {display.scoreVisible ? 'Masquer le score' : 'Afficher le score'}
      </button>
    </section>

    <button class="ghost danger" onclick={reset}>Nouveau match</button>
  </main>

  {#if sheet}
    {@const s = sheet}
    {@const from = pickTeam(s)}
    <div class="sheet">
      <div class="sheet-head">
        <div>
          <small>{config.teams[s.team].name}</small>
          <b>{sheetTitle(s)}</b>
        </div>
        <button class="ghost" onclick={() => (sheet = null)}>Fermer</button>
      </div>

      {#if s.kind === 'penalty'}
        <div class="choices">
          <button onclick={() => send({ type: 'penalty', team: s.team })}>Annoncer le penalty</button>
          <button class="primary" onclick={() => (sheet = { kind: 'goal', team: s.team, goal: 'penalty', step: 'scorer' })}>Marqué</button>
          <button onclick={() => (sheet = { kind: 'missed', team: s.team })}>Raté</button>
        </div>
      {:else}
        {#if s.kind === 'goal' && s.step === 'scorer'}
          <div class="kinds">
            {#each [['normal', 'But'], ['penalty', 'Penalty'], ['own', 'Contre son camp']] as const as [kind, label] (kind)}
              <button class:primary={s.goal === kind} onclick={() => (sheet = { ...s, goal: kind })}>{label}</button>
            {/each}
          </div>
        {/if}
        <div class="players">
          {#each config.teams[from].players as p (p.id)}
            {@const off = isSentOff(match.cards[`${from}:${p.id}`])}
            <button class:bench={!p.starter} disabled={off || (s.kind === 'goal' && s.scorer === p.id) || (s.kind === 'sub' && s.out === p.id)} onclick={() => pick(p.id)}>
              <b>{p.number}</b><span>{p.name}</span>
            </button>
          {/each}
        </div>
        <button class="primary wide" onclick={() => pick()}>
          {s.kind === 'goal' && s.step === 'assist' ? 'Pas de passeur' : s.kind === 'sub' && s.step === 'in' ? 'Valider sans entrant' : 'Valider sans nom'}
        </button>
      {/if}
    </div>
  {/if}
  {#if error}<div class="toast" role="alert">{error}</div>{/if}
{:else}
  <p class="loading">Connexion au serveur…</p>
{/if}

<style>
  :global(html) {
    background: #0a0a0a;
    color: #f3eee4;
    font: 16px/1.3 system-ui, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }
  :global(body) {
    margin: 0;
  }
  main {
    max-width: 520px;
    margin: 0 auto;
    padding: 12px 14px calc(24px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #0a0a0a;
    padding: 8px 0 12px;
    border-bottom: 2px solid #ef5407;
    text-align: center;
  }
  .sim {
    background: #ffd21f;
    color: #0a0a0a;
    font-weight: 800;
    font-size: 13px;
    padding: 6px;
    border-radius: 6px;
    margin-bottom: 6px;
  }
  .status {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #23d17a;
  }
  .status.off {
    color: #ff6a72;
  }
  .score {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 12px;
    font-size: 54px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }
  .score i {
    color: #ef5407;
    font-style: normal;
  }
  .code {
    font-size: 18px;
    font-weight: 700;
    color: #a09a8e;
    width: 52px;
  }
  .clock b {
    font-size: 26px;
    font-variant-numeric: tabular-nums;
  }
  .clock span {
    display: block;
    font-size: 13px;
    color: #a09a8e;
  }
  button {
    font: inherit;
    font-weight: 700;
    color: inherit;
    background: #1c1c1e;
    border: 1px solid #333336;
    border-radius: 10px;
    min-height: 56px;
    padding: 0 12px;
    touch-action: manipulation;
  }
  button:active:not(:disabled) {
    transform: scale(0.97);
    filter: brightness(1.2);
  }
  button:disabled {
    opacity: 0.35;
  }
  .primary {
    background: #f3eee4;
    border-color: #f3eee4;
    color: #0a0a0a;
  }
  .teams,
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .team {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .team .pair {
    gap: 8px;
  }
  .goal {
    min-height: 110px;
    border: 0;
    font-size: 24px;
    font-weight: 900;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .goal small {
    font-size: 13px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .yellow {
    background: #ffd21f;
    border-color: #ffd21f;
    color: #0a0a0a;
  }
  .red {
    background: #f0323c;
    border-color: #f0323c;
    color: #fff;
  }
  .ghost {
    background: none;
    min-height: 46px;
    color: #a09a8e;
    font-size: 14px;
  }
  .danger {
    margin-top: 16px;
    color: #ff6a72;
    border-color: #4a2226;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h2 {
    margin: 8px 0 0;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #a09a8e;
  }
  .stepper {
    display: grid;
    grid-template-columns: 1fr 56px 56px 56px;
    align-items: center;
    gap: 8px;
  }
  .stepper span {
    color: #a09a8e;
  }
  .stepper b {
    text-align: center;
    font-size: 22px;
  }
  .stepper button {
    padding: 0;
    font-size: 24px;
  }
  .done,
  .loading {
    text-align: center;
    color: #a09a8e;
  }
  .loading {
    margin-top: 40vh;
  }

  /* Feuille de choix : plein écran, joueurs en grosses cases. */
  .sheet {
    position: fixed;
    inset: 0;
    z-index: 5;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px calc(14px + env(safe-area-inset-bottom));
    overflow-y: auto;
  }
  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sheet-head small {
    display: block;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #ef5407;
  }
  .sheet-head b {
    font-size: 24px;
  }
  .kinds {
    display: grid;
    grid-template-columns: 1fr 1fr 1.6fr;
    gap: 8px;
  }
  .kinds button {
    min-height: 44px;
    font-size: 14px;
  }
  .players {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .players button {
    min-height: 68px;
    padding: 6px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .players b {
    font-size: 24px;
    line-height: 1;
  }
  .players span {
    font-size: 12px;
    font-weight: 500;
    color: #c9c3b6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .players .bench {
    border-style: dashed;
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .choices button {
    min-height: 72px;
    font-size: 18px;
  }
  .wide {
    position: sticky;
    bottom: 0;
  }
  .toast {
    position: fixed;
    left: 14px;
    right: 14px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    z-index: 9;
    background: #f0323c;
    color: #fff;
    font-weight: 700;
    text-align: center;
    padding: 14px;
    border-radius: 10px;
  }
</style>
