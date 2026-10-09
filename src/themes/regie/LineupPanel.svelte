<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { TeamConfig } from '../../shared/types';
  import { fit, leave, onDark, OUT } from './motion';
  import './regie.css';

  // Composition : une feuille de match. Les lignes se tracent une à une, les noms montent à leur suite.
  let { team, leaving, ongone }: { team: TeamConfig; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const starters = $derived(team.players.filter((p) => p.starter));
  const bench = $derived(team.players.filter((p) => !p.starter));
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.shade'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: OUT }, 0.1)
      .fromTo(q('.sheet'), { '--r': 0 }, { '--r': 1, duration: 0.6, ease: OUT, stagger: 0.1 }, 0.25)
      .fromTo(q('.tab'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: OUT, transformOrigin: '0 50%' }, 0.3)
      .fromTo(q('.tab .chip'), { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, 0.5)
      .fromTo(q('.head .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.08 }, 0.4)
      .fromTo(q('.team'), { letterSpacing: '0.16em' }, { letterSpacing: '0.01em', duration: 1, ease: OUT }, 0.4)
      .fromTo(q('.row i'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: OUT, stagger: 0.03 }, 0.5)
      .fromTo(q('.row .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.45, ease: OUT, stagger: 0.016 }, 0.55);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="regie panel" bind:this={root} style:--c={team.color} style:--lit={onDark(team.color)}>
  <div class="shade"></div>
  <div class="col">
    <div class="rule"></div>
    <div class="head sheet">
      <div class="tab"><span class="chip" class:light={team.logoOnLight}><img src={team.logo} alt="" /></span></div>
      <div class="txt">
        <span class="up"><span class="rise lab">Composition</span></span>
        <span class="up"><span class="rise team" style:font-size="{fit(team.name, 64, tall ? 900 : 1200)}px">{team.name}</span></span>
      </div>
    </div>
    <div class="lists">
      <div class="list sheet">
        <div class="cap"><span class="up"><span class="rise lab">Titulaires</span></span></div>
        {#each starters as p (p.id)}
          <div class="row"><span class="up"><span class="rise mono num">{p.number}</span></span><span class="up"><span class="rise">{p.name}</span></span><i></i></div>
        {/each}
      </div>
      {#if bench.length}
        <div class="list bench sheet">
          <div class="cap"><span class="up"><span class="rise lab">Remplaçants</span></span></div>
          <div class="rows">
            {#each bench as p (p.id)}
              <div class="row"><span class="up"><span class="rise mono num">{p.number}</span></span><span class="up"><span class="rise">{p.name}</span></span><i></i></div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .head {
    display: flex;
    height: 132px;
    margin-top: 3px;
  }
  .tab {
    width: 132px;
    display: grid;
    place-items: center;
    background: var(--c);
    flex: none;
  }
  .tab .chip {
    width: 86px;
    height: 86px;
  }
  .txt {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
    padding: 0 36px;
  }
  .txt .lab {
    color: var(--ac);
  }
  .team {
    font-weight: 900;
  }
  .lists {
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 3px;
    margin-top: 3px;
    align-items: start;
  }
  .list {
    padding: 10px 36px 16px;
  }
  .cap {
    padding: 12px 0 10px;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 22px;
    height: 50px;
    font-size: 29px;
  }
  /* Filet sous chaque ligne. */
  .row i {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--hair);
    transform-origin: 0 50%;
  }
  .num {
    display: inline-block;
    width: 48px;
    text-align: right;
    font-size: 0.82em;
    color: var(--lit);
  }
  .bench .row {
    height: 44px;
    font-size: 24px;
    color: #c9ced6;
  }
  .bench .num {
    color: var(--mut);
  }

  /* Vertical : titulaires puis remplaçants sur deux colonnes. */
  :global(.tall) .lists {
    grid-template-columns: 1fr;
  }
  :global(.tall) .row {
    height: 48px;
    font-size: 28px;
  }
  :global(.tall) .rows {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 36px;
  }
  :global(.tall) .bench .row {
    height: 40px;
    font-size: 21px;
  }
</style>
