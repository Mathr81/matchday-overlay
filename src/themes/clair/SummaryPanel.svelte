<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import { scorers, statRows } from '../../shared/summary';
  import type { Config, MatchState, TeamId } from '../../shared/types';
  import { fit, leave, onLight, POP, softFrom, softTo, SPRING } from './motion';
  import StatRows from './StatRows.svelte';
  import './clair.css';

  // Résumé : une carte blanche avec le score dans une grande capsule sombre, les buteurs sous chaque équipe,
  // les stats saisies et l'homme du match dans une pastille dessous.
  let { config, match, motm, leaving, ongone }: { config: Config; match: MatchState; motm?: { team: TeamId; player: string }; leaving: boolean; ongone: () => void } =
    $props();

  const tall = getContext<boolean>('tall') ?? false;
  const teams: TeamId[] = ['home', 'away'];
  const title = $derived(match.clock.phase === 'ended' ? 'Fin du match' : match.clock.phase === 'break' ? 'Mi-temps' : 'Score');
  const rows = $derived(statRows(match).filter((r) => r.home + r.away > 0));
  const best = $derived(motm ? config.teams[motm.team].players.find((p) => p.id === motm.player) : undefined);
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.shade'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.title'), { scale: 0, rotation: -14 }, { scale: 1, rotation: -2, duration: 0.55, ease: 'back.out(2.2)' }, 0.1)
      .fromTo(q('.card'), { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.5)' }, 0.15)
      .fromTo(q('.side .disc'), { scale: 0, rotation: (i: number) => (i ? 60 : -60) }, { scale: 1, rotation: 0, duration: 1, ease: SPRING, stagger: 0.15 }, 0.4)
      .fromTo(q('.score'), { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(2)' }, 0.5)
      .fromTo(q('.score b'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: SPRING, stagger: 0.12 }, 0.6)
      .fromTo(q('.tx'), softFrom, { ...softTo, stagger: { amount: 0.5 } }, 0.6)
      .fromTo(q('.bar'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'back.out(1.4)', stagger: 0.03 }, 0.9)
      .fromTo(q('.motm'), { scale: 0.5, y: -30, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: POP }, 1.2);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="clair panel" bind:this={root}>
  <div class="shade"></div>
  <div class="col">
    <div class="title cap pop"><b>{title}</b><span>{config.texts.title}</span></div>
    <div class="card">
      <div class="line">
        {#each teams as id (id)}
          {@const t = config.teams[id]}
          <div class="side {id}" style:--c={t.color}>
            <span class="disc pop" class:light={t.logoOnLight}><img src={t.logo} alt="" /></span>
            <span class="name tx" style:font-size="{fit(t.name, tall ? 34 : 48, tall ? 400 : 640)}px">{t.name}</span>
          </div>
          {#if id === 'home'}
            <div class="mid">
              <div class="score cap pop"><b>{match.score.home}</b><i>–</i><b>{match.score.away}</b></div>
              {#if match.shootout}<span class="pens tx">Tirs au but {match.shootout.score.home} – {match.shootout.score.away}</span>{/if}
            </div>
          {/if}
        {/each}
      </div>

      <div class="scorers">
        {#each teams as id (id)}
          <ul class={id} style:--lit={onLight(config.teams[id].color)}>
            {#each scorers(config, match, id) as s, i (i)}
              <li class="tx">{s.name} <b>{s.minute}</b>{#if s.note}<em>{s.note}</em>{/if}</li>
            {/each}
          </ul>
        {/each}
      </div>

      {#if rows.length}<StatRows {rows} {config} />{/if}
    </div>
    {#if best}
      <div class="motm cap pop"><span>Homme du match</span><b>{best.number}</b><strong>{best.name}</strong></div>
    {/if}
  </div>
</div>

<style>
  .col {
    gap: 0 !important;
  }
  .title {
    position: relative;
    z-index: 1;
    gap: 14px;
    height: 58px;
    padding: 0 30px;
    margin-bottom: -22px;
    font-size: 30px;
  }
  .title b {
    font-weight: 800;
  }
  .title span {
    font-size: 20px;
    font-weight: 600;
    opacity: 0.7;
  }
  .card {
    width: 100%;
    padding: 60px 60px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
  }
  .line {
    display: flex;
    align-items: center;
    width: 100%;
  }
  .side {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 26px;
    min-width: 0;
    --ring: 7px;
  }
  .side.away {
    flex-direction: row-reverse;
  }
  .side .disc {
    width: 126px;
    height: 126px;
  }
  .name {
    font-weight: 800;
    white-space: nowrap;
  }
  .mid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    flex: none;
  }
  .score {
    gap: 20px;
    height: 150px;
    padding: 0 54px;
    font-size: 112px;
    font-weight: 800;
  }
  .score b {
    display: inline-block;
    font-weight: 800;
  }
  .score i {
    font-style: normal;
    opacity: 0.4;
  }
  .pens {
    font-size: 22px;
    color: var(--soft);
  }
  .scorers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 340px;
    width: 100%;
  }
  .scorers:not(:has(li)) {
    display: none;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 24px;
    font-weight: 600;
  }
  ul.away {
    text-align: right;
  }
  li b {
    margin-left: 6px;
    color: var(--lit);
    font-weight: 800;
  }
  li em {
    font-style: normal;
    font-size: 0.75em;
    color: var(--soft);
    margin-left: 8px;
  }
  .motm {
    position: relative;
    gap: 16px;
    height: 64px;
    padding: 0 34px;
    margin-top: -24px;
    font-size: 30px;
  }
  .motm span {
    font-size: 20px;
    font-weight: 600;
    opacity: 0.7;
  }
  .motm b {
    color: var(--sun);
    font-weight: 800;
  }
  .motm strong {
    font-weight: 800;
  }

  :global(.tall) .card {
    padding: 56px 34px 44px;
  }
  :global(.tall) .side,
  :global(.tall) .side.away {
    flex-direction: column;
    gap: 14px;
  }
  :global(.tall) .score {
    height: 130px;
    padding: 0 40px;
    font-size: 92px;
  }
  :global(.tall) .scorers {
    gap: 40px;
  }
  :global(.tall) ul {
    font-size: 21px;
  }
</style>
