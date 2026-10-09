<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import { lastKick } from '../../shared/lineup';
  import type { Config, ShootoutState, TeamId } from '../../shared/types';
  import Roll from '../Roll.svelte';
  import { leave, OUT } from './motion';
  import ShootoutPip from './ShootoutPip.svelte';
  import './regie.css';

  // Séance de tirs au but : une ligne par équipe, un voyant par tir, le score de la séance au bout.
  let { config, shootout, leaving, ongone }: { config: Config; shootout: ShootoutState | null; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const teams: TeamId[] = ['home', 'away'];
  const series = $derived(config.format.shootout.kicks);
  const last = $derived(lastKick(config, shootout));
  let root: HTMLDivElement;
  let labels: HTMLSpanElement;
  let tl: gsap.core.Timeline | undefined;
  let wasSudden: boolean | null = null;

  onMount(() => {
    const q = gsap.utils.selector(root);
    wasSudden = shootout?.suddenDeath ?? false;
    gsap.set(labels, { yPercent: wasSudden ? -50 : 0 });
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: OUT }, 0)
      .fromTo(q('.sheet'), { '--r': 0 }, { '--r': 1, duration: 0.5, ease: OUT, stagger: 0.1 }, 0.2)
      .fromTo(q('.stripe'), { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: OUT, stagger: 0.1 }, 0.35)
      .fromTo(q('.chip'), { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(1.8)', stagger: 0.1 }, 0.4)
      .fromTo(q('.rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.45, ease: OUT, stagger: 0.06 }, 0.35)
      .fromTo(q('.pips'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.55);
    return () => tl?.kill();
  });

  // Égalité après la série : l'étiquette bascule sur « Mort subite » et le trait passe au rouge.
  $effect(() => {
    const sudden = shootout?.suddenDeath ?? false;
    if (wasSudden === null || sudden === wasSudden) return;
    wasSudden = sudden;
    gsap.to(labels, { yPercent: sudden ? -50 : 0, duration: 0.5, ease: 'expo.inOut' });
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="regie shoot" class:sudden={shootout?.suddenDeath} bind:this={root} style:--pw="{Math.min(30, Math.floor((tall ? 380 : 520) / (shootout?.rounds ?? series)) - 10)}px">
  <div class="rule"></div>
  <div class="head sheet"><span class="up"><span class="rise"><span class="lab labels" bind:this={labels}><span>Tirs au but</span><span>Mort subite</span></span></span></span>
    {#if last}
      {#key last.id}<span class="last lab fade" class:ko={!last.scored}><b class="mono">{last.number}</b>{last.name}<i></i></span>{/key}
    {/if}
  </div>
  {#each teams as team (team)}
    {@const t = config.teams[team]}
    {@const kicks = shootout?.kicks.filter((k) => k.team === team) ?? []}
    <div class="row sheet" class:lost={!!shootout?.winner && shootout.winner !== team} style:--c={t.color}>
      <i class="stripe"></i>
      <span class="chip" class:light={t.logoOnLight}><img src={t.logo} alt="" /></span>
      <span class="up name"><span class="rise">{tall ? t.code : t.name}</span></span>
      <div class="pips">
        {#each Array(shootout?.rounds ?? series) as _, n (n)}
          <ShootoutPip result={kicks[n]?.scored ?? null} current={shootout?.next === team && n === kicks.length} extra={n >= series} />
        {/each}
      </div>
      <span class="total mono fade"><Roll value={shootout?.score[team] ?? 0} /></span>
    </div>
  {/each}
</div>

<style>
  .shoot {
    position: absolute;
    left: 50%;
    bottom: 84px;
    transform: translateX(-50%);
    visibility: hidden;
    display: flex;
    flex-direction: column;
    gap: 3px;
    filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.5));
  }
  .rule {
    transition: background 0.5s;
  }
  .sudden .rule {
    background: var(--alert);
  }
  .head {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 22px;
  }
  .labels {
    display: block;
    color: var(--ac);
    transition: color 0.5s;
  }
  .sudden .labels {
    color: var(--alert);
  }
  .head :global(.up) {
    height: 14px;
    padding: 0;
    margin: 0;
  }
  /* Nom du dernier tireur, s'il a été saisi, avec un voyant vert ou rouge. */
  .last {
    margin-left: auto;
    padding-left: 30px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--tx);
    white-space: nowrap;
    animation: last-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .last b {
    color: var(--mut);
  }
  .last i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #35d683;
  }
  .last.ko i {
    background: var(--alert);
  }
  @keyframes last-in {
    from {
      transform: translateX(16px);
      opacity: 0;
    }
  }
  .labels span {
    display: block;
    height: 14px;
    line-height: 14px;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 18px;
    height: 72px;
    padding: 0 0 0 26px;
    transition: opacity 0.4s;
  }
  .row.lost {
    opacity: 0.55;
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
  .chip {
    width: 40px;
    height: 40px;
  }
  .name {
    width: 210px;
    font-size: 30px;
  }
  .pips {
    display: flex;
    gap: 10px;
  }
  .total {
    align-self: stretch;
    display: grid;
    place-items: center;
    width: 84px;
    margin-left: 12px;
    background: var(--bg2);
    font-size: 40px;
    font-weight: 800;
  }
  :global(.tall) .shoot {
    bottom: var(--safe-bottom);
  }
  :global(.tall) .name {
    width: 86px;
  }
</style>
