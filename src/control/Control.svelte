<script lang="ts">
  import { onMount } from 'svelte';
  import { connect, savedToken, type Connection } from '../client/connection';
  import PinForm from '../client/PinForm.svelte';
  import { formatClock, isSentOff, periodLabel } from '../shared/clock';
  import { nextSteps } from '../shared/format';
  import { lineup, playerName } from '../shared/lineup';
  import { statLabel } from '../shared/summary';
  import { STAT_KEYS } from '../shared/types';
  import type { Banner, CommandBody, Config, EventPatch, GoalKind, Panel, Player, Snapshot, TeamId, TimelineItem } from '../shared/types';

  type Field = 'scorer' | 'assist' | 'player' | 'in' | 'out';
  type Sheet =
    | { kind: 'goal'; team: TeamId; goal: GoalKind; scorer?: string; step: 'scorer' | 'assist' }
    | { kind: 'card'; team: TeamId; color: 'yellow' | 'red' }
    | { kind: 'sub'; team: TeamId; out?: string; step: 'out' | 'in' }
    | { kind: 'penalty'; team: TeamId }
    | { kind: 'missed'; team: TeamId }
    | { kind: 'prematch' }
    | { kind: 'motm'; team: TeamId }
    | { kind: 'event'; id: string }
    | { kind: 'field'; id: string; field: Field; team: TeamId };

  const UNDO_SECONDS = 10;

  let snapshot = $state<Snapshot | null>(null);
  let offset = 0;
  let online = $state(false);
  let needPin = $state(!savedToken());
  let clockText = $state('00:00');
  let error = $state('');
  let sheet = $state<Sheet | null>(null);
  let undo = $state<{ label: string; target: string } | null>(null);
  let preview = $state(localStorage.getItem('matchday-preview') === '1');
  let clockInput = $state('');
  let bannerTitle = $state('');
  let bannerSubtitle = $state('');
  // Mode correction des stats : un appui retire un au lieu d'ajouter.
  let statMinus = $state(false);
  // Tireur du prochain tir au but, facultatif : remis à vide après chaque tir.
  let kicker = $state('');
  let connection: Connection | undefined;
  let errorTimer: ReturnType<typeof setTimeout>;
  let undoTimer: ReturnType<typeof setTimeout>;

  const phase = $derived(snapshot?.match.clock.phase ?? 'pre');
  const playing = $derived(phase === 'running' || phase === 'paused');
  const added = $derived(snapshot?.match.clock.addedMinutes ?? 0);
  const steps = $derived(snapshot ? nextSteps(snapshot.match, snapshot.config.format) : { period: false, shootout: false, end: false });
  const shootout = $derived(snapshot?.match.shootout ?? null);
  const history = $derived(snapshot ? [...snapshot.match.timeline].reverse() : []);
  const teams: TeamId[] = ['home', 'away'];
  const other = (team: TeamId): TeamId => (team === 'home' ? 'away' : 'home');

  function open() {
    connection?.close();
    connection = connect('control', {
      onSnapshot: (s, o) => {
        snapshot = s;
        offset = o;
      },
      onStatus: (o) => (online = o),
      onDenied: () => (needPin = true),
    });
  }

  onMount(() => {
    if (!needPin) open();
    const id = setInterval(() => {
      if (snapshot) clockText = formatClock(snapshot.match.clock, snapshot.config.format, Date.now() + offset);
    }, 200);
    return () => {
      clearInterval(id);
      connection?.close();
    };
  });

  function fail(message: string) {
    error = message;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => (error = ''), 4000);
  }

  /** Envoie une commande. Avec `label`, propose ensuite de l'annuler pendant quelques secondes. */
  async function send(body: CommandBody, label?: string) {
    if (!connection) return;
    sheet = null;
    navigator.vibrate?.(15);
    const ack = await connection.send(body);
    if (!ack.ok) return fail(ack.reason ?? 'Commande refusée.');
    if (!label) return;
    undo = { label, target: ack.cid };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undo = null), UNDO_SECONDS * 1000);
  }

  function undoLast() {
    if (!undo) return;
    const target = undo.target;
    undo = null;
    send({ type: 'void_event', target });
  }

  function reset() {
    if (confirm('Démarrer un nouveau match ? Le match en cours sera archivé.')) send({ type: 'reset_match' });
  }

  function endMatch() {
    if (confirm('Terminer le match sur ce score ?')) send({ type: 'end_match' });
  }

  function kick(team: TeamId, scored: boolean) {
    send({ type: 'shootout_kick', team, scored, player: kicker || undefined }, `Tir ${scored ? 'marqué' : 'raté'}`);
    kicker = '';
  }

  function togglePreview() {
    preview = !preview;
    localStorage.setItem('matchday-preview', preview ? '1' : '0');
  }

  function setClock() {
    const m = clockInput.trim().match(/^(\d{1,3})(?::(\d{1,2}))?$/);
    if (!m) return fail('Écris le temps comme 67:24.');
    send({ type: 'set_clock', seconds: Number(m[1]) * 60 + Number(m[2] ?? 0) });
    clockInput = '';
  }

  /** Retire un but à une équipe : annule son dernier but, sans annonce. */
  function minusOne(team: TeamId) {
    const goal = history.find((t) => t.type === 'goal' && t.team === team);
    if (goal) send({ type: 'void_event', target: goal.id });
  }

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  /** Affiche un panneau, ou le retire si c'est déjà celui à l'antenne. */
  function togglePanel(panel: Panel) {
    const on = snapshot?.display.panel?.type === panel.type && (panel.type !== 'lineup' || same(snapshot.display.panel, panel));
    send({ type: 'set_panel', panel: on ? null : panel });
  }

  /** Avant-match, avec un compte à rebours de `minutes` (0 : sans). */
  function prematch(minutes: number) {
    send({ type: 'set_panel', panel: minutes ? { type: 'prematch', kickoffAt: Date.now() + offset + minutes * 60_000 } : { type: 'prematch' } });
  }

  function toggleBanner(banner: Banner) {
    send({ type: 'set_banner', banner: same(snapshot?.display.banner, banner) ? null : banner });
  }

  function showFreeBanner() {
    send({ type: 'set_banner', banner: { title: bannerTitle, subtitle: bannerSubtitle || undefined } });
  }

  const name = (config: Config, id: string | undefined) => playerName(config, id) || 'sans nom';

  function describe(config: Config, t: TimelineItem): string {
    switch (t.type) {
      case 'goal':
        return `${t.kind === 'own' ? 'But csc' : t.kind === 'penalty' ? 'But sur penalty' : 'But'} · ${name(config, t.scorer)}`;
      case 'card':
        return `${t.color === 'yellow' ? 'Carton jaune' : 'Carton rouge'} · ${name(config, t.player)}`;
      case 'substitution':
        return `Remplacement · ${name(config, t.in)} pour ${name(config, t.out)}`;
      case 'penalty_awarded':
        return 'Penalty';
      case 'penalty_missed':
        return `Penalty raté · ${name(config, t.player)}`;
    }
  }

  // Équipe dont on choisit un joueur : pour un csc, le buteur est dans l'équipe adverse.
  function pickTeam(s: Sheet): TeamId | null {
    if (s.kind === 'event' || s.kind === 'prematch') return null;
    if (s.kind === 'field') return s.team;
    return s.kind === 'goal' && s.goal === 'own' && s.step === 'scorer' ? other(s.team) : s.team;
  }

  /** Joueurs proposés : sur le terrain d'abord, banc ensuite ; pour un remplacement, seulement ceux qui ont du sens. */
  function candidates(config: Config, s: Sheet, team: TeamId): { player: Player; bench: boolean }[] {
    if (!snapshot) return [];
    const { pitch, bench } = lineup(config, snapshot.match, team);
    const on = pitch.map((player) => ({ player, bench: false }));
    const off = bench.map((player) => ({ player, bench: true }));
    if (s.kind === 'sub') return s.step === 'out' ? on : off;
    return [...on, ...off];
  }

  function sheetTitle(s: Sheet): string {
    if (s.kind === 'goal') return s.step === 'assist' ? 'Passeur ?' : 'Buteur ?';
    if (s.kind === 'card') return s.color === 'yellow' ? 'Carton jaune pour…' : 'Carton rouge pour…';
    if (s.kind === 'sub') return s.step === 'out' ? 'Qui sort ?' : 'Qui entre ?';
    if (s.kind === 'missed') return 'Penalty raté par…';
    if (s.kind === 'field') return 'Choisir le joueur';
    if (s.kind === 'prematch') return 'Avant-match';
    if (s.kind === 'motm') return 'Homme du match';
    if (s.kind === 'event') return 'Modifier';
    return 'Penalty';
  }

  /** Un joueur a été touché, ou « sans nom » (id indéfini). */
  function pick(config: Config, id?: string) {
    const s = sheet;
    if (!s) return;
    const team = config.teams['team' in s ? s.team : 'home'].name;
    if (s.kind === 'goal') {
      if (s.step === 'scorer' && id && s.goal === 'normal') sheet = { ...s, scorer: id, step: 'assist' };
      else if (s.step === 'scorer') send({ type: 'goal', team: s.team, kind: s.goal, scorer: id }, `But ${team} · ${name(config, id)}`);
      else send({ type: 'goal', team: s.team, kind: s.goal, scorer: s.scorer, assist: id }, `But ${team} · ${name(config, s.scorer)}`);
    } else if (s.kind === 'card') send({ type: 'card', team: s.team, color: s.color, player: id }, `Carton ${s.color === 'yellow' ? 'jaune' : 'rouge'} · ${name(config, id)}`);
    else if (s.kind === 'missed') send({ type: 'penalty_missed', team: s.team, player: id }, `Penalty raté · ${name(config, id)}`);
    else if (s.kind === 'sub') {
      if (s.step === 'out' && id) sheet = { ...s, out: id, step: 'in' };
      else send({ type: 'substitution', team: s.team, out: s.out, in: id }, `Remplacement ${team}`);
    } else if (s.kind === 'field') patch(s.id, { [s.field]: id ?? null });
    else if (s.kind === 'motm') send({ type: 'set_panel', panel: id ? { type: 'summary', motm: { team: s.team, player: id } } : { type: 'summary' } });
  }

  const patch = (target: string, change: EventPatch) => send({ type: 'edit_event', target, patch: change });

  function editMinute(t: TimelineItem) {
    const answer = prompt('Minute du fait de match', t.minute.replace("'", ''));
    if (answer?.trim()) patch(t.id, { minute: `${answer.trim().replace(/'/g, '')}'` });
  }

  /** Champs « joueur » modifiables d'un fait de match, avec l'équipe où chercher. */
  function fields(t: TimelineItem): { field: Field; label: string; team: TeamId }[] {
    if (t.type === 'goal') {
      const scorer = { field: 'scorer' as const, label: 'Changer le buteur', team: t.kind === 'own' ? other(t.team) : t.team };
      return t.kind === 'normal' ? [scorer, { field: 'assist', label: 'Changer le passeur', team: t.team }] : [scorer];
    }
    if (t.type === 'card' || t.type === 'penalty_missed') return [{ field: 'player', label: 'Changer le joueur', team: t.team }];
    if (t.type === 'substitution')
      return [
        { field: 'in', label: "Changer l'entrant", team: t.team },
        { field: 'out', label: 'Changer le sortant', team: t.team },
      ];
    return [];
  }
</script>

{#if needPin}
  <PinForm
    onok={() => {
      needPin = false;
      open();
    }}
  />
{:else if snapshot}
  {@const { config, match, display } = snapshot}
  <main>
    <header>
      {#if snapshot.simulation}<div class="sim">Simulation — le vrai match n'est pas touché</div>{/if}
      <div class="status" class:off={!online}>
        {online ? 'Connecté' : 'Hors ligne — reconnexion…'} · {display.scoreVisible ? 'score à l\'antenne' : 'score masqué'}
      </div>
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

    {#if preview}
      <iframe class="preview" title="Aperçu de l'antenne" src="/overlay/16x9?bg"></iframe>
    {/if}

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

    <section class="block">
      <h2>Chrono</h2>
      {#if phase === 'pre' || phase === 'break'}
        {#if steps.period}
          <button class="primary" onclick={() => send({ type: 'start_period' })}>
            {phase === 'pre' ? "Coup d'envoi" : match.clock.period >= config.format.periods ? 'Lancer la prolongation' : 'Lancer la période suivante'}
          </button>
        {/if}
        {#if steps.shootout}
          <p class="done">Égalité. Tirs au but : qui tire en premier ?</p>
          <div class="pair">
            {#each teams as team (team)}
              <button class:primary={!steps.period} onclick={() => send({ type: 'start_shootout', first: team })}>{config.teams[team].name}</button>
            {/each}
          </div>
        {/if}
        {#if steps.end}<button class="ghost" onclick={endMatch}>Terminer sur ce score</button>{/if}
      {:else if phase === 'shootout' && shootout?.next}
        {@const team = shootout.next}
        <p class="done">
          Tirs au but {shootout.score.home} – {shootout.score.away}{shootout.suddenDeath ? ' · mort subite' : ''} · au tour de <b>{config.teams[team].name}</b>
        </p>
        <select class="kicker" bind:value={kicker} aria-label="Tireur">
          <option value="">Tireur (facultatif)</option>
          {#each lineup(config, match, team).pitch.filter((p) => !isSentOff(match.cards[`${team}:${p.id}`])) as p (p.id)}
            <option value={p.id}>{p.number} {p.name}</option>
          {/each}
        </select>
        <div class="pair kicks">
          <button class="scored" onclick={() => kick(team, true)}>Marqué</button>
          <button class="red" onclick={() => kick(team, false)}>Raté</button>
        </div>
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
        <p class="done">
          Match terminé{shootout ? ` · tirs au but ${shootout.score.home} – ${shootout.score.away}` : ''}.
        </p>
        {#if shootout?.winner || match.score.home !== match.score.away}
          <button class="primary" onclick={() => send({ type: 'announce_winner' })}>Annoncer le vainqueur à l'antenne</button>
        {/if}
      {/if}
      {#if shootout?.kicks.length}
        <button class="ghost" onclick={() => send({ type: 'void_event', target: shootout.kicks[shootout.kicks.length - 1].id })}>Annuler le dernier tir</button>
      {/if}
    </section>

    <section class="block">
      <h2>Antenne</h2>
      <div class="pair">
        <button class:primary={!display.scoreVisible} onclick={() => send({ type: 'set_score_visible', visible: !display.scoreVisible })}>
          {display.scoreVisible ? 'Masquer le score' : 'Afficher le score'}
        </button>
        <button onclick={togglePreview}>{preview ? "Cacher l'aperçu" : "Voir l'aperçu"}</button>
      </div>
    </section>

    <section class="block">
      <h2>Panneaux</h2>
      <div class="grid3">
        <button class:primary={display.panel?.type === 'prematch'} onclick={() => (display.panel?.type === 'prematch' ? send({ type: 'set_panel', panel: null }) : (sheet = { kind: 'prematch' }))}>
          Avant-match
        </button>
        {#each teams as team (team)}
          <button class:primary={same(display.panel, { type: 'lineup', team })} onclick={() => togglePanel({ type: 'lineup', team })}>Compo {config.teams[team].code}</button>
        {/each}
        <button class:primary={display.panel?.type === 'summary'} onclick={() => togglePanel({ type: 'summary' })}>Résumé</button>
        <button class:primary={display.panel?.type === 'stats'} onclick={() => togglePanel({ type: 'stats' })}>Stats</button>
        <button class:primary={display.panel?.type === 'holding'} onclick={() => togglePanel({ type: 'holding' })}>Attente</button>
        {#if shootout}
          <button class:primary={display.panel?.type === 'shootout'} onclick={() => togglePanel({ type: 'shootout' })}>Tirs au but</button>
        {/if}
      </div>
      {#if display.panel?.type === 'summary'}
        <div class="pair">
          {#each teams as team (team)}
            <button onclick={() => (sheet = { kind: 'motm', team })}>Homme du match {config.teams[team].code}</button>
          {/each}
        </div>
      {/if}
    </section>

    <section class="block">
      <h2>Bandeaux</h2>
      {#each config.banners as b (b.title)}
        <button class="event" class:primary={same(display.banner, b)} onclick={() => toggleBanner(b)}>
          <span class="min">{b.qr ? 'QR' : ''}</span><i></i><span class="what">{b.title}</span>
        </button>
      {/each}
      <form
        class="free"
        onsubmit={(ev) => {
          ev.preventDefault();
          showFreeBanner();
        }}
      >
        <input bind:value={bannerTitle} placeholder="Titre" maxlength="80" aria-label="Titre du bandeau" />
        <input bind:value={bannerSubtitle} placeholder="Sous-titre (facultatif)" maxlength="120" aria-label="Sous-titre du bandeau" />
        <div class="pair">
          <button class="primary" disabled={!bannerTitle.trim()}>Afficher</button>
          <button type="button" disabled={!display.banner} onclick={() => send({ type: 'set_banner', banner: null })}>Retirer le bandeau</button>
        </div>
      </form>
    </section>

    <section class="block">
      <h2>Stats</h2>
      {#each STAT_KEYS as key (key)}
        <div class="statline">
          <button disabled={statMinus && match.stats.home[key] === 0} onclick={() => send({ type: 'stat', team: 'home', key, delta: statMinus ? -1 : 1 })}>{match.stats.home[key]}</button>
          <span>{statLabel(key)}</span>
          <button disabled={statMinus && match.stats.away[key] === 0} onclick={() => send({ type: 'stat', team: 'away', key, delta: statMinus ? -1 : 1 })}>{match.stats.away[key]}</button>
        </div>
      {/each}
      <button class="ghost" class:primary={statMinus} onclick={() => (statMinus = !statMinus)}>
        {statMinus ? 'Mode correction : un appui retire 1' : 'Un appui ajoute 1 — passer en correction'}
      </button>
    </section>

    <section class="block">
      <h2>Historique</h2>
      {#each history as t (t.id)}
        <button class="event" onclick={() => (sheet = { kind: 'event', id: t.id })}>
          <span class="min">{t.minute}</span>
          <i style:background={config.teams[t.team].color}></i>
          <span class="what">{describe(config, t)}</span>
        </button>
      {:else}
        <p class="done">Rien pour l'instant. Touche un événement pour le corriger ou l'annuler.</p>
      {/each}
    </section>

    <section class="block">
      <h2>Corrections sans annonce</h2>
      {#each teams as team (team)}
        <div class="stepper">
          <span>Score {config.teams[team].name}</span>
          <button disabled={match.score[team] <= 0} onclick={() => minusOne(team)}>−</button>
          <b>{match.score[team]}</b>
          <button onclick={() => send({ type: 'goal', team, silent: true })}>+</button>
        </div>
      {/each}
      <form
        class="clockfix"
        onsubmit={(ev) => {
          ev.preventDefault();
          setClock();
        }}
      >
        <input bind:value={clockInput} placeholder="Chrono, ex. 67:24" inputmode="numeric" aria-label="Nouveau temps du chrono" disabled={!playing} />
        <button disabled={!playing || !clockInput}>Régler</button>
      </form>
    </section>

    <button class="ghost danger" onclick={reset}>Nouveau match</button>
  </main>

  {#if sheet}
    {@const s = sheet}
    {@const from = pickTeam(s)}
    {@const event = s.kind === 'event' || s.kind === 'field' ? match.timeline.find((t) => t.id === s.id) : undefined}
    <div class="sheet">
      <div class="sheet-head">
        <div>
          <small>{event ? `${event.minute} · ${describe(config, event)}` : 'team' in s ? config.teams[s.team].name : ''}</small>
          <b>{sheetTitle(s)}</b>
        </div>
        <button class="ghost" onclick={() => (sheet = null)}>Fermer</button>
      </div>

      {#if s.kind === 'penalty'}
        <div class="choices">
          <button onclick={() => send({ type: 'penalty', team: s.team }, `Penalty ${config.teams[s.team].name}`)}>Annoncer le penalty</button>
          <button class="primary" onclick={() => (sheet = { kind: 'goal', team: s.team, goal: 'penalty', step: 'scorer' })}>Marqué</button>
          <button onclick={() => (sheet = { kind: 'missed', team: s.team })}>Raté</button>
        </div>
      {:else if s.kind === 'prematch'}
        <div class="choices">
          <button class="primary" onclick={() => prematch(0)}>Sans compte à rebours</button>
          {#each [5, 10, 15, 30] as minutes (minutes)}
            <button onclick={() => prematch(minutes)}>Coup d'envoi dans {minutes} min</button>
          {/each}
        </div>
      {:else if s.kind === 'event'}
        {#if event}
          <div class="choices">
            {#each fields(event) as f (f.field)}
              <button onclick={() => (sheet = { kind: 'field', id: event.id, field: f.field, team: f.team })}>{f.label}</button>
            {/each}
            <button onclick={() => editMinute(event)}>Changer la minute</button>
            <button onclick={() => patch(event.id, { team: other(event.team), scorer: null, assist: null, player: null, in: null, out: null })}>
              Attribuer à {config.teams[other(event.team)].name}
            </button>
            {#if event.type === 'goal'}
              <button onclick={() => send({ type: 'disallow_goal', target: event.id })}>Refuser ce but (annoncé à l'antenne)</button>
            {/if}
            <button class="red" onclick={() => send({ type: 'void_event', target: event.id })}>Supprimer sans annonce</button>
          </div>
        {/if}
      {:else if from}
        {#if s.kind === 'goal' && s.step === 'scorer'}
          <div class="kinds">
            {#each [['normal', 'But'], ['penalty', 'Penalty'], ['own', 'Contre son camp']] as const as [kind, label] (kind)}
              <button class:primary={s.goal === kind} onclick={() => (sheet = { ...s, goal: kind })}>{label}</button>
            {/each}
          </div>
        {/if}
        <div class="players">
          {#each candidates(config, s, from) as { player: p, bench } (p.id)}
            {@const off = isSentOff(match.cards[`${from}:${p.id}`])}
            <button class:bench disabled={off || (s.kind === 'goal' && s.scorer === p.id)} onclick={() => pick(config, p.id)}>
              <b>{p.number}</b><span>{p.name}</span>
            </button>
          {/each}
        </div>
        <button class="primary wide" onclick={() => pick(config)}>
          {s.kind === 'field' || s.kind === 'motm' ? 'Aucun joueur' : s.kind === 'goal' && s.step === 'assist' ? 'Pas de passeur' : s.kind === 'sub' && s.step === 'in' ? 'Valider sans entrant' : 'Valider sans nom'}
        </button>
      {/if}
    </div>
  {/if}

  {#if undo && !sheet}
    <div class="undo">
      <span>{undo.label}</span>
      <button onclick={undoLast}>Annuler</button>
      <i style:animation-duration="{UNDO_SECONDS}s"></i>
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
    padding: 12px 14px calc(96px + env(safe-area-inset-bottom));
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
  .preview {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    border: 1px solid #333336;
    border-radius: 10px;
    pointer-events: none;
  }
  .event {
    display: grid;
    grid-template-columns: 52px 6px 1fr;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    text-align: left;
    font-weight: 500;
  }
  .event .min {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .event i {
    align-self: stretch;
    margin: 8px 0;
    border-radius: 3px;
  }
  .event .what {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kicker {
    width: 100%;
    min-height: 52px;
    margin-bottom: 8px;
    padding: 0 14px;
    font: inherit;
    font-size: 17px;
    color: inherit;
    background: #1b1b1d;
    border: 1px solid #2a2a2e;
    border-radius: 10px;
  }
  .kicks button {
    min-height: 96px;
    font-size: 22px;
    font-weight: 900;
  }
  .scored {
    background: #23d17a;
    border-color: #23d17a;
    color: #0a0a0a;
  }
  .done b {
    color: #f3eee4;
  }
  .grid3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .grid3 button {
    padding: 0 4px;
    font-size: 14px;
  }
  .free {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .free input {
    font: inherit;
    color: inherit;
    background: #1c1c1e;
    border: 1px solid #333336;
    border-radius: 10px;
    padding: 14px;
    min-width: 0;
  }
  .statline {
    display: grid;
    grid-template-columns: 76px 1fr 76px;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .statline span {
    color: #c9c3b6;
  }
  .statline button {
    font-size: 22px;
    font-weight: 900;
    min-height: 50px;
  }
  .clockfix {
    display: grid;
    grid-template-columns: 1fr 120px;
    gap: 8px;
  }
  .clockfix input {
    font: inherit;
    color: inherit;
    background: #1c1c1e;
    border: 1px solid #333336;
    border-radius: 10px;
    padding: 0 14px;
    min-width: 0;
  }
  /* Annulation rapide : reste dix secondes après chaque action, la barre du bas se vide pendant ce temps. */
  .undo {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    z-index: 4;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 16px;
    background: #f3eee4;
    color: #0a0a0a;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }
  .undo span {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .undo button {
    background: #0a0a0a;
    border-color: #0a0a0a;
    color: #f3eee4;
    min-height: 48px;
    padding: 0 22px;
  }
  .undo i {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 4px;
    width: 100%;
    background: #ef5407;
    transform-origin: 0 50%;
    animation: drain linear forwards;
  }
  @keyframes drain {
    to {
      transform: scaleX(0);
    }
  }
</style>
