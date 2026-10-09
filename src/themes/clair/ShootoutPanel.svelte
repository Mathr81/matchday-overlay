<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import { lastKick } from '../../shared/lineup';
  import type { Config, ShootoutState, TeamId } from '../../shared/types';
  import Roll from '../Roll.svelte';
  import { leave, softFrom, softTo, SPRING } from './motion';
  import ShootoutPip from './ShootoutPip.svelte';
  import './clair.css';

  // Séance de tirs au but : une ligne par équipe, une bille par tir, le score de la séance dans une capsule.
  let { config, shootout, leaving, ongone }: { config: Config; shootout: ShootoutState | null; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const teams: TeamId[] = ['home', 'away'];
  const series = $derived(config.format.shootout.kicks);
  const last = $derived(lastKick(config, shootout));
  let root: HTMLDivElement;
  let labels: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;
  let wasSudden: boolean | null = null;

  onMount(() => {
    const q = gsap.utils.selector(root);
    wasSudden = shootout?.suddenDeath ?? false;
    gsap.set(labels, { yPercent: wasSudden ? -50 : 0 });
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.card'), { scale: 0.6, opacity: 0, y: 60 }, { scale: 1, opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.5)' }, 0)
      .fromTo(q('.title'), { scale: 0, rotation: -14 }, { scale: 1, rotation: -2, duration: 0.55, ease: 'back.out(2.2)' }, 0.2)
      .fromTo(q('.disc'), { scale: 0 }, { scale: 1, duration: 0.9, ease: SPRING, stagger: 0.12 }, 0.25)
      .fromTo(q('.tx'), softFrom, { ...softTo, stagger: 0.1 }, 0.3)
      .fromTo(q('.total'), { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.1 }, 0.4)
      .fromTo(q('.pips'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);
    return () => tl?.kill();
  });

  // Égalité après la série : l'étiquette bascule sur « Mort subite » en rebondissant.
  $effect(() => {
    const sudden = shootout?.suddenDeath ?? false;
    if (wasSudden === null || sudden === wasSudden) return;
    wasSudden = sudden;
    gsap.to(labels, { yPercent: sudden ? -50 : 0, duration: 0.6, ease: 'back.inOut(1.8)' });
    if (sudden) gsap.fromTo(root.querySelector('.title'), { scale: 1 }, { scale: 1.2, duration: 0.15, yoyo: true, repeat: 1, delay: 0.2 });
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="clair shoot" class:sudden={shootout?.suddenDeath} bind:this={root} style:--pw="{Math.min(36, Math.floor((tall ? 400 : 560) / (shootout?.rounds ?? series)) - 8)}px">
  <div class="tops">
    <div class="title cap pop"><div bind:this={labels}><span>Tirs au but</span><span>Mort subite</span></div></div>
    {#if last}
      {#key last.id}<div class="last pop" class:ko={!last.scored}><i></i>{last.number} {last.name}</div>{/key}
    {/if}
  </div>
  <div class="card">
    {#each teams as team (team)}
      {@const t = config.teams[team]}
      {@const kicks = shootout?.kicks.filter((k) => k.team === team) ?? []}
      <div class="row" class:lost={!!shootout?.winner && shootout.winner !== team} style:--c={t.color}>
        <span class="disc pop" class:light={t.logoOnLight}><img src={t.logo} alt="" /></span>
        <span class="name tx">{tall ? t.code : t.name}</span>
        <div class="pips">
          {#each Array(shootout?.rounds ?? series) as _, n (n)}
            <ShootoutPip result={kicks[n]?.scored ?? null} current={shootout?.next === team && n === kicks.length} extra={n >= series} />
          {/each}
        </div>
        <span class="total cap pop"><Roll value={shootout?.score[team] ?? 0} ease="back.inOut(1.6)" /></span>
      </div>
    {/each}
  </div>
</div>

<style>
  .shoot {
    position: absolute;
    left: 50%;
    bottom: 76px;
    transform: translateX(-50%);
    visibility: hidden;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    filter: drop-shadow(0 14px 24px rgba(16, 24, 40, 0.3));
  }
  .title {
    position: relative;
    z-index: 1;
    display: block;
    height: 40px;
    padding: 0 22px;
    margin: 0 0 0 34px;
    font-size: 21px;
    font-weight: 800;
    overflow: hidden;
    transition: background 0.4s;
  }
  .sudden .title {
    background: var(--alert);
  }
  .tops {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: -14px;
  }
  /* Nom du dernier tireur, s'il a été saisi, avec une bille verte ou rouge. */
  .last {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 36px;
    padding: 0 16px 0 10px;
    border-radius: 999px;
    background: var(--paper);
    box-shadow: inset 0 0 0 2px var(--fog);
    font-size: 19px;
    white-space: nowrap;
    animation: last-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  .last i {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--ok);
  }
  .last.ko i {
    background: var(--alert);
  }
  @keyframes last-in {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
  }
  .title span {
    display: block;
    height: 40px;
    line-height: 40px;
  }
  .card {
    padding: 26px 22px 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 16px;
    transition: opacity 0.4s;
  }
  .row.lost {
    opacity: 0.45;
  }
  .disc {
    width: 54px;
    height: 54px;
  }
  .name {
    width: 200px;
    font-size: 30px;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
  }
  .pips {
    display: flex;
    gap: 8px;
  }
  .total {
    justify-content: center;
    width: 76px;
    height: 54px;
    margin-left: 10px;
    font-size: 36px;
    font-weight: 800;
  }
  :global(.tall) .shoot {
    bottom: var(--safe-bottom);
  }
  :global(.tall) .name {
    width: 80px;
  }
</style>
