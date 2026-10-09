<script lang="ts">
  import { onMount } from 'svelte';
  import { connect, savedToken, type Connection } from '../client/connection';
  import PinForm from '../client/PinForm.svelte';
  import type { Snapshot } from '../shared/types';
  import { script, seconds } from './script';

  let snapshot = $state<Snapshot | null>(null);
  let offset = 0;
  let connection: Connection | undefined;
  let needPin = $state(!savedToken());
  let running = $state(false);
  let index = $state(-1);
  let speed = $state(1);
  let error = $state('');
  // Change à chaque lancement ou arrêt : une exécution en cours s'aperçoit qu'elle n'est plus la bonne.
  let run = 0;

  const chapters = [...new Set(script.map((s) => s.chapter))].filter(Boolean);
  const chapter = $derived(script[index]?.chapter ?? '');

  onMount(() => {
    if (!needPin) open();
    return () => connection?.close();
  });

  function open() {
    connection = connect('control', { onSnapshot: (s, o) => ((snapshot = s), (offset = o)), onDenied: () => (needPin = true) });
  }

  const sleep = (s: number) => new Promise((r) => setTimeout(r, (s * 1000) / speed));

  async function send(body: Parameters<Connection['send']>[0]) {
    if (!connection) return false;
    const ack = await connection.send(body);
    if (!ack.ok) error = ack.reason ?? 'Commande refusée.';
    return ack.ok;
  }

  async function start() {
    const mine = ++run;
    error = '';
    running = true;
    // On repart d'un match de simulation vide, à part du vrai match.
    await send({ type: 'simulation', on: false });
    await send({ type: 'simulation', on: true });
    await send({ type: 'set_panel', panel: null });
    await send({ type: 'set_banner', banner: null });
    for (index = 0; index < script.length && mine === run; index++) {
      const step = script[index];
      if (step.clock) await send({ type: 'set_clock', seconds: seconds(step.clock) });
      let command = step.command;
      if (step.countdown && command.type === 'set_panel' && command.panel?.type === 'prematch') {
        command = { ...command, panel: { type: 'prematch', kickoffAt: Date.now() + offset + (step.countdown * 1000) / speed } };
      }
      if ('target' in command && command.target === '$lastGoal') command = { ...command, target: snapshot?.match.lastGoalId ?? '' };
      if (!(await send(command))) break;
      await sleep(step.wait);
    }
    if (mine !== run) return;
    running = false;
    index = script.length - 1;
  }

  async function quit() {
    run++;
    running = false;
    index = -1;
    await send({ type: 'set_panel', panel: null });
    await send({ type: 'set_banner', banner: null });
    await send({ type: 'simulation', on: false });
  }
</script>

{#if needPin}
  <PinForm
    onok={() => {
      needPin = false;
      open();
    }}
  />
{:else}
<main>
  <aside>
    <h1>Simulation</h1>
    <p>Rejoue un match complet pour juger les animations. Le vrai match est mis de côté et revient intact quand tu quittes.</p>

    <div class="row">
      <button class="primary" onclick={start}>{running ? 'Relancer' : 'Lancer le match'}</button>
      <button onclick={quit} disabled={!snapshot?.simulation}>Quitter</button>
    </div>
    <div class="row speeds">
      {#each [1, 2, 4] as s (s)}
        <button class:primary={speed === s} onclick={() => (speed = s)}>×{s}</button>
      {/each}
    </div>
    {#if error}<p class="error">{error}</p>{/if}

    <ol>
      {#each chapters as c (c)}
        <li class:now={c === chapter} class:past={index >= 0 && chapters.indexOf(c) < chapters.indexOf(chapter)}>{c}</li>
      {/each}
    </ol>
    <p class="state">
      {#if snapshot?.simulation}
        Simulation en cours{running ? '' : ' (terminée ou en pause)'} · {snapshot.match.score.home} – {snapshot.match.score.away}
      {:else}
        Vrai match à l'antenne.
      {/if}
    </p>
  </aside>
  <section>
    <iframe title="Aperçu de l'overlay" src="/overlay/16x9?bg"></iframe>
    <p>Aperçu de l'overlay. L'entrée vMix ou OBS montre la même chose au même moment.</p>
  </section>
</main>
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
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 28px;
    padding: 24px;
    max-width: 1500px;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 22px;
  }
  p {
    color: #9b978f;
    margin: 0 0 14px;
  }
  .row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  button {
    flex: 1;
    font: inherit;
    font-weight: 700;
    color: inherit;
    background: #1b1b1d;
    border: 1px solid #2e2e31;
    border-radius: 6px;
    padding: 11px 12px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .primary {
    background: #ef5407;
    border-color: #ef5407;
    color: #0a0a0a;
  }
  ol {
    margin: 18px 0;
    padding: 0;
    list-style: none;
    border-left: 2px solid #2e2e31;
  }
  li {
    padding: 5px 12px;
    margin-left: -2px;
    border-left: 2px solid transparent;
    color: #9b978f;
  }
  li.past {
    color: #5d5a55;
  }
  li.now {
    color: #edeae4;
    font-weight: 700;
    border-left-color: #ef5407;
  }
  .error {
    color: #ff6a72;
  }
  .state {
    font-size: 13px;
  }
  iframe {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    border: 0;
    border-radius: 8px;
    background: #22382b;
  }
  section p {
    margin-top: 10px;
    font-size: 13px;
  }
  @media (max-width: 900px) {
    main {
      grid-template-columns: 1fr;
    }
  }
</style>
