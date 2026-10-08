<script lang="ts">
  import { onMount } from 'svelte';
  import { connect, type Connection } from '../client/connection';
  import { formatClock, periodLabel } from '../shared/clock';
  import type { CommandBody, Snapshot, TeamId } from '../shared/types';

  let snapshot = $state<Snapshot | null>(null);
  let offset = 0;
  let online = $state(false);
  let clockText = $state('00:00');
  let error = $state('');
  let connection: Connection;
  let errorTimer: ReturnType<typeof setTimeout>;

  const phase = $derived(snapshot?.match.clock.phase ?? 'pre');
  const playing = $derived(phase === 'running' || phase === 'paused');
  const added = $derived(snapshot?.match.clock.addedMinutes ?? 0);
  const teams: TeamId[] = ['home', 'away'];

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
</script>

{#if snapshot}
  {@const { config, match, display } = snapshot}
  <main>
    <header>
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

    <section class="goals">
      {#each teams as team (team)}
        <button class="goal" style:background={config.teams[team].color} onclick={() => send({ type: 'goal', team })}>
          <small>But</small>{config.teams[team].name}
        </button>
      {/each}
    </section>
    <button class="ghost" disabled={!match.lastGoalId} onclick={() => match.lastGoalId && send({ type: 'void_event', target: match.lastGoalId })}>
      Annuler le dernier but
    </button>

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
    padding: 0 16px;
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
  .goals,
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .goal {
    min-height: 120px;
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
  .ghost {
    background: none;
    min-height: 46px;
    color: #a09a8e;
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
  .toast {
    position: fixed;
    left: 14px;
    right: 14px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    background: #f0323c;
    color: #fff;
    font-weight: 700;
    text-align: center;
    padding: 14px;
    border-radius: 10px;
  }
</style>
