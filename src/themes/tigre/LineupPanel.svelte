<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { TeamConfig } from '../../shared/types';
  import { fit, inkOn, leave, OUT } from './motion';
  import './tigre.css';

  // Composition : les lignes descendent en suivant l'inclinaison du thème, titulaires puis remplaçants.
  let { team, leaving, ongone }: { team: TeamConfig; leaving: boolean; ongone: () => void } = $props();

  const starters = $derived(team.players.filter((p) => p.starter));
  const bench = $derived(team.players.filter((p) => !p.starter));
  // Vertical : une seule colonne, les remplaçants à la suite des titulaires, toujours sur la même pente.
  const tall = getContext<boolean>('tall') ?? false;
  const drift = tall ? 13.75 : 15.5;
  const benchDrift = tall ? 11.25 : 13;
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.shade'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.tile, .heading'), { '--p': 0 }, { '--p': 1, duration: 0.6, ease: OUT, stagger: 0.08 }, 0.1)
      .fromTo(q('.tile .crest'), { scale: 0.2, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2)' }, 0.25)
      .fromTo(q('.heading > *'), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: OUT, stagger: 0.07 }, 0.3)
      .fromTo(q('.heading b'), { '--wd': 50 }, { '--wd': 100, duration: 1, ease: OUT }, 0.3)
      .fromTo(q('.starters .row'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.045 }, 0.45)
      .fromTo(q('.starters .row > *'), { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: OUT, stagger: 0.0225 }, 0.55)
      .fromTo(q('.label, .bench .row'), { '--p': 0 }, { '--p': 1, duration: 0.45, ease: OUT, stagger: 0.045 }, 0.8)
      .fromTo(q('.label > *, .bench .row > *'), { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, stagger: 0.02 }, 0.9);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="tigre panel" bind:this={root} style:--team={team.color} style:--ink={inkOn(team.color)} style:--hfs="{tall ? fit(team.name, 72, 900) : 92}px">
  <div class="shade"></div>
  <div class="tile para"><div class="crest" class:chip={team.logoOnLight}><img src={team.logo} alt="" /></div></div>
  <div class="heading para hatch"><span>Composition</span><b>{team.name}</b></div>

  <div class="starters">
    {#each starters as p, i (p.id)}
      <div class="row para hatch" style:margin-left="{-i * drift}px"><span class="num">{p.number}</span><span>{p.name}</span></div>
    {/each}
  </div>

  {#if bench.length}
    <div class="bench" style:left={tall ? `${266 - starters.length * drift}px` : undefined} style:top={tall ? `calc(var(--safe-top) + ${174 + starters.length * 55}px)` : undefined}>
      <div class="label para"><span>Remplaçants</span></div>
      {#each bench as p, i (p.id)}
        <div class="row para" style:margin-left="{-(i + 1) * benchDrift}px"><span class="num">{p.number}</span><span>{p.name}</span></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tile {
    position: absolute;
    left: 200px;
    top: 96px;
    width: 230px;
    height: 170px;
    --s: 42px;
    background: var(--team);
    display: grid;
    place-items: center;
  }
  .tile .crest {
    width: 130px;
    height: 130px;
  }
  .heading {
    position: absolute;
    left: 396px;
    top: 96px;
    height: 170px;
    --s: 42px;
    padding: 0 110px 0 84px;
    background-color: var(--k);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  }
  .heading span {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.16em;
    --wd: 88;
    color: var(--o);
  }
  .heading b {
    font-size: var(--hfs);
    white-space: nowrap;
  }
  .starters {
    position: absolute;
    left: 420px;
    top: 300px;
  }
  .row {
    width: max-content;
    display: flex;
    align-items: center;
    white-space: nowrap;
  }
  .starters .row {
    height: 56px;
    --s: 14px;
    min-width: 640px;
    margin-bottom: 6px;
    padding: 0 60px 0 34px;
    gap: 22px;
    background-color: rgba(10, 10, 10, 0.96);
    font-size: 33px;
    --wd: 92;
  }
  .starters .num {
    width: 56px;
    text-align: right;
    color: var(--o);
    font-variation-settings: 'wdth' 70;
  }
  .bench {
    position: absolute;
    left: 1180px;
    top: 300px;
  }
  .label {
    height: 40px;
    --s: 10px;
    width: max-content;
    padding: 0 30px 0 28px;
    display: flex;
    align-items: center;
    background: var(--team);
    color: var(--ink);
    font-size: 19px;
    font-weight: 800;
    letter-spacing: 0.14em;
    --wd: 88;
    margin-bottom: 6px;
  }
  .bench .row {
    height: 46px;
    --s: 11.5px;
    min-width: 440px;
    margin-bottom: 6px;
    padding: 0 44px 0 28px;
    gap: 18px;
    background: var(--w);
    color: var(--k);
    font-size: 25px;
    font-weight: 800;
    --wd: 88;
  }
  .bench .num {
    width: 40px;
    text-align: right;
    opacity: 0.55;
  }

  :global(.tall) .tile {
    left: 60px;
    top: var(--safe-top);
    width: 176px;
    height: 132px;
    --s: 33px;
  }
  :global(.tall) .tile .crest {
    width: 100px;
    height: 100px;
  }
  :global(.tall) .heading {
    left: 210px;
    top: var(--safe-top);
    height: 132px;
    --s: 33px;
    padding: 0 76px 0 62px;
  }
  :global(.tall) .heading span {
    font-size: 20px;
  }
  :global(.tall) .starters {
    left: 270px;
    top: calc(var(--safe-top) + 160px);
  }
  :global(.tall) .starters .row {
    height: 50px;
    --s: 12.5px;
    min-width: 620px;
    margin-bottom: 5px;
    padding: 0 50px 0 30px;
    font-size: 30px;
  }
  :global(.tall) .bench .row {
    height: 40px;
    --s: 10px;
    min-width: 430px;
    margin-bottom: 5px;
    font-size: 22px;
  }
</style>
