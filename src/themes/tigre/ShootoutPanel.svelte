<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import { lastKick } from '../../shared/lineup';
  import type { Config, ShootoutState, TeamId } from '../../shared/types';
  import { leave, OUT } from './motion';
  import RollNumber from './RollNumber.svelte';
  import ShootoutPip from './ShootoutPip.svelte';
  import './tigre.css';

  // Séance de tirs au but : une ligne par équipe, une case par tir, le score de la séance au bout.
  let { config, shootout, leaving, ongone }: { config: Config; shootout: ShootoutState | null; leaving: boolean; ongone: () => void } = $props();

  const teams: TeamId[] = ['home', 'away'];
  const series = $derived(config.format.shootout.kicks);
  // Vertical : sigle au lieu du nom, et des cases qui rétrécissent si la mort subite s'éternise.
  const tall = getContext<boolean>('tall') ?? false;
  const last = $derived(lastKick(config, shootout));
  const pipWidth = $derived(tall ? `${Math.min(58, Math.floor(440 / (shootout?.rounds ?? series)))}px` : undefined);
  let root: HTMLDivElement;
  let labels: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;
  let wasSudden: boolean | null = null;

  onMount(() => {
    const q = gsap.utils.selector(root);
    wasSudden = shootout?.suddenDeath ?? false;
    gsap.set(labels, { y: wasSudden ? -40 : 0 });
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.head'), { '--p': 0 }, { '--p': 1, duration: 0.45, ease: OUT }, 0)
      .fromTo(q('.row'), { '--p': 0 }, { '--p': 1, duration: 0.7, ease: OUT, stagger: 0.1 }, 0.1)
      .fromTo(q('.tile, .name, .total'), { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: OUT, stagger: 0.04 }, 0.3)
      .fromTo(q('.pips'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);
    return () => tl?.kill();
  });

  // Égalité après la série : l'étiquette bascule sur « Mort subite » avec un éclat.
  $effect(() => {
    const sudden = shootout?.suddenDeath ?? false;
    if (wasSudden === null || sudden === wasSudden) return;
    wasSudden = sudden;
    gsap.to(labels, { y: sudden ? -40 : 0, duration: 0.5, ease: 'expo.inOut' });
    if (sudden) gsap.fromTo(root.querySelector('.head'), { backgroundColor: '#F3EEE4' }, { backgroundColor: '#EF5407', duration: 0.8, delay: 0.2 });
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="tigre shoot" bind:this={root} style:--pw={pipWidth}>
  <div class="tops">
    <div class="head para"><div bind:this={labels}><span>Tirs au but</span><span>Mort subite</span></div></div>
    {#if last}
      {#key last.id}<div class="last para" class:ko={!last.scored}><span>{last.number} {last.name}</span></div>{/key}
    {/if}
  </div>
  {#each teams as team, i (team)}
    {@const t = config.teams[team]}
    {@const kicks = shootout?.kicks.filter((k) => k.team === team) ?? []}
    <div class="row para hatch" class:second={i === 1} class:lost={!!shootout?.winner && shootout.winner !== team}>
      <span class="tile" class:light={t.logoOnLight} style:background={t.logoOnLight ? undefined : t.color}><img src={t.logo} alt="" /></span>
      <span class="name">{tall ? t.code : t.name}</span>
      <div class="pips">
        {#each Array(shootout?.rounds ?? series) as _, n (n)}
          <ShootoutPip result={kicks[n]?.scored ?? null} current={shootout?.next === team && n === kicks.length} extra={n >= series} />
        {/each}
      </div>
      <span class="total"><RollNumber value={shootout?.score[team] ?? 0} /></span>
    </div>
  {/each}
</div>

<style>
  .shoot {
    position: absolute;
    left: 50%;
    margin-left: -470px;
    bottom: 84px;
    visibility: hidden;
    filter: drop-shadow(0 16px 26px rgba(0, 0, 0, 0.55));
  }
  .head {
    height: 40px;
    --s: 10px;
    width: max-content;
    padding: 0 30px 0 28px;
    background: var(--o);
    color: var(--k);
    font-size: 19px;
    font-weight: 800;
    letter-spacing: 0.14em;
    --wd: 88;
    overflow: hidden;
  }
  .tops {
    display: flex;
  }
  /* Nom du dernier tireur, s'il a été saisi : vert s'il a marqué, rouge sinon. */
  .last {
    height: 40px;
    --s: 10px;
    margin-left: -3px;
    padding: 0 28px 0 26px;
    display: flex;
    align-items: center;
    background: #23d17a;
    color: var(--k);
    font-size: 19px;
    font-weight: 800;
    letter-spacing: 0.06em;
    --wd: 88;
    white-space: nowrap;
    animation: last-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .last.ko {
    background: #f0323c;
    color: #fff;
  }
  @keyframes last-in {
    from {
      transform: translateX(-30px);
      opacity: 0;
    }
  }
  .head span {
    display: block;
    height: 40px;
    line-height: 41px;
  }
  .row {
    height: 78px;
    --s: 19.5px;
    width: max-content;
    margin: 5px 0 0 -21px;
    padding: 0 16px 0 34px;
    display: flex;
    align-items: center;
    gap: 20px;
    background-color: rgba(10, 10, 10, 0.96);
    transition: opacity 0.4s;
  }
  .row.second {
    margin-left: -42px;
  }
  .row.lost {
    opacity: 0.5;
  }
  .tile {
    width: 60px;
    height: 50px;
    display: grid;
    place-items: center;
    clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
  }
  .tile.light {
    background: var(--w);
  }
  .tile img {
    display: block;
    max-width: 38px;
    max-height: 38px;
  }
  .name {
    width: 176px;
    font-size: 34px;
    --wd: 84;
    white-space: nowrap;
    overflow: hidden;
  }
  .pips {
    display: flex;
  }
  .total {
    width: 92px;
    height: 58px;
    margin-left: 14px;
    display: grid;
    place-items: center;
    background: var(--w);
    color: var(--k);
    clip-path: polygon(14.5px 0, 100% 0, calc(100% - 14.5px) 100%, 0 100%);
    font-size: 44px;
    --wd: 100;
  }
  :global(.tall) .shoot {
    left: 50%;
    margin-left: 0;
    transform: translateX(-50%);
    bottom: var(--safe-bottom);
  }
  :global(.tall) .name {
    width: 92px;
  }
</style>
