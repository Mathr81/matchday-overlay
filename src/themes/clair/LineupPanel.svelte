<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { TeamConfig } from '../../shared/types';
  import { fit, inkOn, leave, softFrom, softTo, SPRING } from './motion';
  import './clair.css';

  // Composition : chaque joueur est une pastille avec son numéro dans un rond. Elles éclosent une à une.
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
      .fromTo(q('.card'), { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.5)' }, 0.1)
      .fromTo(q('.head .disc'), { scale: 0, rotation: -60 }, { scale: 1, rotation: 0, duration: 1, ease: SPRING }, 0.3)
      .fromTo(q('.head .tx'), softFrom, { ...softTo, stagger: 0.1 }, 0.4)
      .fromTo(q('.chip'), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)', stagger: 0.035 }, 0.55)
      .fromTo(q('.label'), softFrom, softTo, 0.9);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="clair panel" bind:this={root} style:--c={team.color} style:--cink={inkOn(team.color)}>
  <div class="shade"></div>
  <div class="col">
    <div class="card">
      <div class="head">
        <span class="disc pop" class:light={team.logoOnLight}><img src={team.logo} alt="" /></span>
        <div>
          <span class="kicker tx">Composition</span>
          <span class="team tx" style:font-size="{fit(team.name, 66, tall ? 800 : 1300)}px">{team.name}</span>
        </div>
      </div>
      <div class="grid">
        {#each starters as p (p.id)}
          <div class="chip pop"><b>{p.number}</b><span>{p.name}</span></div>
        {/each}
      </div>
      {#if bench.length}
        <span class="label">Remplaçants</span>
        <div class="grid bench">
          {#each bench as p (p.id)}
            <div class="chip pop"><b>{p.number}</b><span>{p.name}</span></div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .card {
    width: 100%;
    padding: 44px 54px 50px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 30px;
    margin-bottom: 34px;
    --ring: 7px;
  }
  .head .disc {
    width: 124px;
    height: 124px;
  }
  .kicker {
    display: block;
    font-size: 24px;
    font-weight: 600;
    color: var(--soft);
    margin-bottom: 4px;
  }
  .team {
    display: block;
    font-weight: 800;
    white-space: nowrap;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 62px;
    padding: 0 22px 0 7px;
    border-radius: 999px;
    background: var(--fog);
    font-size: 26px;
    white-space: nowrap;
    overflow: hidden;
  }
  .chip b {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--c);
    color: var(--cink);
    font-size: 22px;
    font-weight: 800;
    flex: none;
  }
  .label {
    display: block;
    margin: 30px 0 14px 8px;
    font-size: 22px;
    font-weight: 600;
    color: var(--soft);
  }
  .bench {
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .bench .chip {
    height: 50px;
    background: none;
    box-shadow: inset 0 0 0 2px var(--fog);
    font-size: 21px;
    gap: 12px;
  }
  .bench .chip b {
    width: 36px;
    height: 36px;
    background: var(--fog);
    color: var(--ink);
    font-size: 17px;
  }

  :global(.tall) .card {
    padding: 40px 36px 44px;
  }
  :global(.tall) .grid {
    grid-template-columns: repeat(2, 1fr);
  }
  :global(.tall) .chip {
    height: 58px;
    font-size: 25px;
  }
  :global(.tall) .bench .chip {
    height: 48px;
    font-size: 21px;
  }
</style>
