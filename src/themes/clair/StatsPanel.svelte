<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import { statRows } from '../../shared/summary';
  import type { Config, MatchState, TeamId } from '../../shared/types';
  import { leave, softFrom, softTo, SPRING } from './motion';
  import StatRows from './StatRows.svelte';
  import './clair.css';

  // Stats en cours de match : carte blanche en bas, le jeu reste visible au-dessus.
  let { config, match, leaving, ongone }: { config: Config; match: MatchState; leaving: boolean; ongone: () => void } = $props();

  const teams: TeamId[] = ['home', 'away'];
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.card'), { scale: 0.6, opacity: 0, y: 60 }, { scale: 1, opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.5)' }, 0)
      .fromTo(q('.disc'), { scale: 0 }, { scale: 1, duration: 0.9, ease: SPRING, stagger: 0.12 }, 0.25)
      .fromTo(q('.tx'), softFrom, { ...softTo, stagger: { amount: 0.4 } }, 0.3)
      .fromTo(q('.bar'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'back.out(1.4)', stagger: 0.03 }, 0.45);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="clair stats-panel" bind:this={root}>
  <div class="card">
    <div class="head">
      {#each teams as id (id)}
        {@const t = config.teams[id]}
        <span class="disc pop" class:light={t.logoOnLight} style:--c={t.color}><img src={t.logo} alt="" /></span>
        {#if id === 'home'}<span class="tx">Statistiques</span>{/if}
      {/each}
    </div>
    <StatRows rows={statRows(match)} {config} />
  </div>
</div>

<style>
  .stats-panel {
    position: absolute;
    left: 50%;
    bottom: 76px;
    width: 940px;
    margin-left: -470px;
    visibility: hidden;
    filter: drop-shadow(0 14px 24px rgba(16, 24, 40, 0.3));
  }
  .card {
    padding: 22px 40px 26px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 26px;
    font-weight: 800;
  }
  .disc {
    width: 54px;
    height: 54px;
  }
  :global(.tall) .stats-panel {
    bottom: var(--safe-bottom);
    width: 920px;
    margin-left: -460px;
  }
</style>
