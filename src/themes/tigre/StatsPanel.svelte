<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import { statRows } from '../../shared/summary';
  import type { Config, MatchState } from '../../shared/types';
  import { inkOn, leave, OUT } from './motion';
  import StatRows from './StatRows.svelte';
  import './tigre.css';

  // Stats en cours de match : panneau bas, le jeu reste visible au-dessus.
  let { config, match, leaving, ongone }: { config: Config; match: MatchState; leaving: boolean; ongone: () => void } = $props();

  const home = $derived(config.teams.home);
  const away = $derived(config.teams.away);
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.head > .para'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.07 }, 0)
      .fromTo(q('.head > .para > *'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: OUT, stagger: 0.07 }, 0.15)
      .fromTo(q('.stat'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.06 }, 0.2)
      .fromTo(q('.stat > *'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.012 }, 0.4);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="tigre stats-panel" bind:this={root}>
  <div class="head">
    <div class="para code" style:background={home.color} style:color={inkOn(home.color)}><span>{home.code}</span></div>
    <div class="para name"><span>Statistiques</span></div>
    <div class="para code" style:background={away.color} style:color={inkOn(away.color)}><span>{away.code}</span></div>
  </div>
  <StatRows rows={statRows(match)} {config} />
</div>

<style>
  .stats-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 84px;
    visibility: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    filter: drop-shadow(0 16px 26px rgba(0, 0, 0, 0.55));
  }
  .head {
    display: flex;
    width: 1000px;
    margin-left: 22px;
  }
  .head > .para {
    height: 50px;
    --s: 12.5px;
    display: grid;
    place-items: center;
    margin-right: -7px;
  }
  .code {
    width: 150px;
    font-size: 26px;
    --wd: 84;
  }
  .name {
    flex: 1;
    background: var(--w);
    color: var(--k);
    font-size: 21px;
    font-weight: 800;
    letter-spacing: 0.16em;
    --wd: 88;
  }
  :global(.tall) .stats-panel {
    bottom: var(--safe-bottom);
  }
  :global(.tall) .head {
    width: 900px;
  }
  :global(.tall) .code {
    width: 130px;
  }
</style>
