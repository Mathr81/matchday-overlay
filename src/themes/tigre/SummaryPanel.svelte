<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import { scorers, statRows } from '../../shared/summary';
  import type { Config, MatchState, TeamId } from '../../shared/types';
  import { inkOn, leave, OUT } from './motion';
  import StatRows from './StatRows.svelte';
  import './tigre.css';

  // Résumé : score en grand, buteurs de chaque côté, stats saisies, homme du match.
  let { config, match, motm, leaving, ongone }: { config: Config; match: MatchState; motm?: { team: TeamId; player: string }; leaving: boolean; ongone: () => void } =
    $props();

  const home = $derived(config.teams.home);
  const away = $derived(config.teams.away);
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
      .fromTo(q('.title, .event'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.08 }, 0.1)
      .fromTo(q('.title > *, .event > *'), { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, stagger: 0.08 }, 0.25)
      .fromTo(q('.seg'), { '--p': 0 }, { '--p': 1, duration: 0.7, ease: OUT, stagger: 0.09 }, 0.25)
      .fromTo(q('.seg .crest'), { scale: 0.2, rotation: -30, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)', stagger: 0.2 }, 0.5)
      .fromTo(q('.seg .team'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: OUT, stagger: 0.1 }, 0.5)
      .fromTo(q('.seg .team'), { '--wd': 50 }, { '--wd': 96, duration: 1, ease: OUT }, 0.5)
      .fromTo(q('.digits > *'), { yPercent: 120 }, { yPercent: 0, duration: 0.6, ease: OUT, stagger: 0.08 }, 0.6)
      .fromTo(q('.scorers li'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: OUT, stagger: 0.05 }, 0.85)
      .fromTo(q('.stat'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.06 }, 1)
      .fromTo(q('.stat > *'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.012 }, 1.15)
      .fromTo(q('.motm > *'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.08 }, 1.2);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="tigre panel" bind:this={root}>
  <div class="shade"></div>
  <div class="column">
    <div class="top">
      <div class="title para"><span>{title}</span></div>
      <div class="event para"><span>{config.texts.title}</span></div>
    </div>

    <div class="scoreline">
      <div class="seg para side" style:background-color={home.color} style:color={inkOn(home.color)}>
        <div class="crest" class:chip={home.logoOnLight}><img src={home.logo} alt="" /></div>
        <span class="team">{home.name}</span>
      </div>
      <div class="seg para hatch score">
        <span class="digits"><b>{match.score.home}</b></span><i class="slash"></i><span class="digits"><b>{match.score.away}</b></span>
      </div>
      <div class="seg para side right" style:background-color={away.color} style:color={inkOn(away.color)}>
        <span class="team">{away.name}</span>
        <div class="crest" class:chip={away.logoOnLight}><img src={away.logo} alt="" /></div>
      </div>
    </div>

    <div class="scorers">
      {#each ['home', 'away'] as const as team (team)}
        <ul class={team}>
          {#each scorers(config, match, team) as s, i (i)}
            <li><span>{s.name}</span> <b>{s.minute}</b>{#if s.note}<em>{s.note}</em>{/if}</li>
          {/each}
        </ul>
      {/each}
    </div>

    {#if rows.length}<StatRows {rows} {config} />{/if}

    {#if best}
      <div class="motm">
        <div class="para tag"><span>Homme du match</span></div>
        <div class="para hatch who"><b>{best.number}</b><span>{best.name}</span></div>
      </div>
    {/if}
  </div>
</div>

<style>
  .column {
    position: absolute;
    left: 0;
    right: 0;
    top: 110px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
  }
  .top {
    display: flex;
    align-self: flex-start;
    margin-left: 300px;
  }
  .title,
  .event {
    height: 60px;
    --s: 15px;
    display: flex;
    align-items: center;
    padding: 0 40px 0 42px;
    margin-right: -9px;
    white-space: nowrap;
  }
  .title {
    background: var(--o);
    color: var(--k);
    font-size: 36px;
    --wd: 100;
  }
  .event {
    background: var(--w);
    color: var(--k);
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.12em;
    --wd: 88;
  }
  .scoreline {
    display: flex;
  }
  .seg {
    height: 176px;
    --s: 44px;
    display: flex;
    align-items: center;
    margin-right: -30px;
  }
  .side {
    width: 540px;
    gap: 30px;
    padding: 0 70px 0 84px;
    background-image: repeating-linear-gradient(104deg, rgba(0, 0, 0, 0.075) 0 3px, transparent 3px 18px);
  }
  .right {
    justify-content: flex-end;
    padding: 0 84px 0 70px;
    margin-right: 0;
  }
  .seg .crest {
    width: 120px;
    height: 120px;
  }
  .team {
    font-size: 62px;
    white-space: nowrap;
  }
  .score {
    background-color: var(--k);
    padding: 0 80px;
    gap: 26px;
    font-size: 140px;
    --wd: 100;
  }
  .digits {
    display: block;
    height: 150px;
    overflow: hidden;
  }
  .digits b {
    display: block;
    line-height: 156px;
    padding: 0 14px;
    font-weight: 900;
  }
  .slash {
    width: 14px;
    height: 80px;
    background: var(--o);
    transform: skewX(-14deg);
  }
  .scorers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 260px;
    width: 1500px;
    min-height: 20px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 28px;
    font-weight: 800;
    --wd: 88;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
  }
  ul.home {
    text-align: right;
  }
  li b {
    color: var(--o);
    font-weight: 900;
    margin-left: 6px;
  }
  li em {
    font-style: inherit;
    font-size: 0.7em;
    opacity: 0.65;
    margin-left: 8px;
  }
  .motm {
    display: flex;
    margin-top: 6px;
  }
  .motm > * {
    height: 64px;
    --s: 16px;
    display: flex;
    align-items: center;
    margin-right: -10px;
    white-space: nowrap;
  }
  .tag {
    background: var(--o);
    color: var(--k);
    padding: 0 38px;
    font-size: 21px;
    font-weight: 800;
    letter-spacing: 0.13em;
    --wd: 88;
  }
  .who {
    background-color: var(--k);
    padding: 0 50px 0 42px;
    gap: 16px;
    font-size: 36px;
  }
  .who b {
    color: var(--o);
    font-weight: 900;
  }
</style>
