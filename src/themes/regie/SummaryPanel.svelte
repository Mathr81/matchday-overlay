<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import { scorers, statRows } from '../../shared/summary';
  import type { Config, MatchState, TeamId } from '../../shared/types';
  import { fit, leave, onDark, OUT } from './motion';
  import StatRows from './StatRows.svelte';
  import './regie.css';

  // Résumé : score en grand entre les deux équipes, buteurs sous chacune, stats saisies, homme du match.
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
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: OUT, transformOrigin: '50% 50%' }, 0.1)
      .fromTo(q('.sheet'), { '--r': 0 }, { '--r': 1, duration: 0.55, ease: OUT, stagger: 0.1 }, 0.28)
      .fromTo(q('.stripe'), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: OUT, stagger: 0.1 }, 0.45)
      .fromTo(q('.side .chip'), { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.6)', stagger: 0.12 }, 0.5)
      .fromTo(q('.rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.5, ease: OUT, stagger: { amount: 0.7 } }, 0.4)
      .fromTo(q('.digits'), { letterSpacing: '0.3em' }, { letterSpacing: '0em', duration: 1, ease: OUT }, 0.5)
      .fromTo(q('.bar'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: OUT, stagger: 0.03 }, 0.9);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="regie panel" bind:this={root}>
  <div class="shade"></div>
  <div class="col">
    <div class="head">
      <span class="up"><span class="rise title">{title}</span></span>
      <span class="up"><span class="rise lab">{config.texts.title}</span></span>
    </div>
    <div class="rule"></div>
    <div class="line sheet">
      {#each teams as id (id)}
        {@const t = config.teams[id]}
        <div class="side {id}" style:--c={t.color}>
          <i class="stripe"></i>
          <span class="chip" class:light={t.logoOnLight}><img src={t.logo} alt="" /></span>
          <span class="up"><span class="rise name" style:font-size="{fit(t.name, tall ? 34 : 54, tall ? 400 : 560)}px">{t.name}</span></span>
        </div>
        {#if id === 'home'}
          <div class="score">
            <span class="up"><span class="rise mono digits">{match.score.home}<em>–</em>{match.score.away}</span></span>
            {#if match.shootout}
              <span class="up"><span class="rise lab pens">Tirs au but <b class="mono">{match.shootout.score.home}–{match.shootout.score.away}</b></span></span>
            {/if}
          </div>
        {/if}
      {/each}
    </div>

    <div class="scorers sheet">
      {#each teams as id (id)}
        <ul class={id} style:--lit={onDark(config.teams[id].color)}>
          {#each scorers(config, match, id) as s, i (i)}
            <li><span class="up"><span class="rise">{s.name}<b class="mono">{s.minute}</b>{#if s.note}<em>{s.note}</em>{/if}</span></span></li>
          {/each}
        </ul>
      {/each}
    </div>

    {#if rows.length}<StatRows {rows} {config} />{/if}

    {#if best}
      <div class="motm sheet">
        <span class="up"><span class="rise lab">Homme du match</span></span>
        <span class="up"><span class="rise who"><b class="mono">{best.number}</b>{best.name}</span></span>
      </div>
    {/if}
  </div>
</div>

<style>
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 30px;
    padding: 0 4px 16px;
  }
  .title {
    font-size: 38px;
    font-weight: 800;
    color: var(--ac);
  }
  .head .lab {
    font-size: 17px;
  }
  .line {
    display: flex;
    align-items: center;
    height: 190px;
    margin-top: 3px;
  }
  .side {
    position: relative;
    flex: 1;
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: 30px;
    padding: 0 44px;
    min-width: 0;
  }
  .side.away {
    flex-direction: row-reverse;
  }
  .stripe {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    background: var(--c);
    transform-origin: 50% 0;
  }
  .away .stripe {
    left: auto;
    right: 0;
  }
  .side .chip {
    width: 108px;
    height: 108px;
  }
  .name {
    font-weight: 900;
  }
  .score {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex: none;
    padding: 0 20px;
  }
  .digits {
    font-size: 112px;
    font-weight: 800;
  }
  .digits em {
    font-style: normal;
    color: var(--mut);
    margin: 0 0.12em;
  }
  .pens {
    color: var(--ac);
  }
  .pens b {
    margin-left: 10px;
  }
  .scorers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 240px;
    margin-top: 3px;
    padding: 0 44px;
  }
  .scorers:not(:has(li)) {
    display: none;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 16px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 23px;
    font-weight: 600;
  }
  ul.away {
    text-align: right;
  }
  li b {
    margin-left: 12px;
    color: var(--lit);
    font-size: 0.86em;
  }
  li em {
    font-style: normal;
    font-size: 0.7em;
    color: var(--mut);
    margin-left: 8px;
  }
  .col > :global(.stats) {
    margin-top: 3px;
  }
  .motm {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 28px;
    height: 66px;
    margin-top: 3px;
  }
  .motm .lab {
    color: var(--ac);
  }
  .who {
    font-size: 32px;
    font-weight: 800;
  }
  .who b {
    margin-right: 14px;
    font-size: 0.84em;
    color: var(--mut);
  }

  /* Vertical : chaque équipe en colonne (logo, nom) de part et d'autre du score. */
  :global(.tall) .line {
    height: 250px;
  }
  :global(.tall) .side,
  :global(.tall) .side.away {
    flex-direction: column;
    justify-content: center;
    gap: 18px;
    padding: 0 20px;
  }
  :global(.tall) .digits {
    font-size: 96px;
  }
  :global(.tall) .scorers {
    gap: 40px;
    padding: 0 28px;
  }
  :global(.tall) ul {
    font-size: 20px;
  }
</style>
