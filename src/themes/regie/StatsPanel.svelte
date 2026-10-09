<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import { statRows } from '../../shared/summary';
  import type { Config, MatchState, TeamId } from '../../shared/types';
  import { leave, OUT } from './motion';
  import StatRows from './StatRows.svelte';
  import './regie.css';

  // Stats en cours de match : tableau bas, le jeu reste visible au-dessus.
  let { config, match, leaving, ongone }: { config: Config; match: MatchState; leaving: boolean; ongone: () => void } = $props();

  const teams: TeamId[] = ['home', 'away'];
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: OUT, transformOrigin: '50% 50%' }, 0)
      .fromTo(q('.sheet'), { '--r': 0 }, { '--r': 1, duration: 0.5, ease: OUT, stagger: 0.1 }, 0.2)
      .fromTo(q('.stripe'), { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: OUT }, 0.35)
      .fromTo(q('.rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.45, ease: OUT, stagger: { amount: 0.5 } }, 0.3)
      .fromTo(q('.bar'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: OUT, stagger: 0.03 }, 0.5);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="regie stats-panel" bind:this={root}>
  <div class="rule"></div>
  <div class="head sheet">
    {#each teams as id (id)}
      {@const t = config.teams[id]}
      <div class="code {id}" style:--c={t.color}><i class="stripe"></i><span class="up"><span class="rise">{t.code}</span></span></div>
      {#if id === 'home'}<span class="up"><span class="rise lab">Statistiques</span></span>{/if}
    {/each}
  </div>
  <StatRows rows={statRows(match)} {config} />
</div>

<style>
  .stats-panel {
    position: absolute;
    left: 50%;
    bottom: 84px;
    width: 940px;
    margin-left: -470px;
    visibility: hidden;
    display: flex;
    flex-direction: column;
    gap: 3px;
    filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.5));
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 50px;
  }
  .head .lab {
    color: var(--ac);
  }
  .code {
    position: relative;
    align-self: stretch;
    display: flex;
    align-items: center;
    padding: 0 26px;
    font-size: 25px;
  }
  .stripe {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    background: var(--c);
    transform-origin: 50% 0;
  }
  .away .stripe {
    left: auto;
    right: 0;
  }
  :global(.tall) .stats-panel {
    bottom: var(--safe-bottom);
    width: 900px;
    margin-left: -450px;
  }
</style>
