<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { Config, TeamId } from '../../shared/types';
  import { countdownText, fit } from '../util';
  import { leave, OUT } from './motion';
  import './regie.css';

  // Affiche du match : un cadre tracé depuis le centre, les deux équipes de part et d'autre d'un trait, le compte à rebours en dessous.
  let { config, kickoffAt, offset, leaving, ongone }: { config: Config; kickoffAt?: number; offset: number; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const teams: TeamId[] = ['home', 'away'];
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;
  let remaining = $state<number | null>(null);
  const countdown = $derived(countdownText(remaining));

  onMount(() => {
    const tick = () => (remaining = kickoffAt === undefined ? null : kickoffAt - (Date.now() + offset));
    tick();
    const id = setInterval(tick, 200);
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.shade'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: OUT, transformOrigin: '50% 50%', stagger: 0.08 }, 0.1)
      .fromTo(q('.sheet'), { '--r': 0 }, { '--r': 1, duration: 0.55, ease: OUT, stagger: 0.12 }, 0.3)
      .fromTo(q('.stripe'), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: OUT, stagger: 0.1 }, 0.5)
      .fromTo(q('.glow'), { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.1 }, 0.55)
      .fromTo(q('.side .chip'), { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.12 }, 0.6)
      .fromTo(q('.rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.6, ease: OUT, stagger: 0.07 }, 0.5)
      .fromTo(q('.name'), { letterSpacing: '0.2em' }, { letterSpacing: '0.01em', duration: 1.1, ease: OUT }, 0.6)
      .fromTo(q('.mid i'), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: OUT }, 0.6)
      .fromTo(q('.mid b'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 0.9);
    return () => {
      clearInterval(id);
      tl?.kill();
    };
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="regie panel" bind:this={root}>
  <div class="shade"></div>
  <div class="col">
    <div class="head">
      <span class="up"><span class="rise title">{config.texts.title}</span></span>
      <span class="up"><span class="rise lab">{config.texts.subtitle}</span></span>
    </div>
    <div class="rule"></div>
    <div class="teams sheet">
      {#each teams as id (id)}
        {@const t = config.teams[id]}
        <div class="side {id}" style:--c={t.color}>
          <i class="glow fade"></i><i class="stripe"></i>
          <span class="chip" class:light={t.logoOnLight}><img src={t.logo} alt="" /></span>
          <span class="up"><span class="rise name" style:font-size="{fit(t.name, tall ? 76 : 84, tall ? 760 : 560)}px">{t.name}</span></span>
        </div>
        {#if id === 'home'}<div class="mid"><i></i><b class="lab">vs</b></div>{/if}
      {/each}
    </div>
    <div class="rule"></div>
    {#if countdown}
      <div class="count sheet">
        <span class="up"><span class="rise lab">{remaining !== null && remaining > 0 ? "Coup d'envoi dans" : "Coup d'envoi"}</span></span>
        <span class="up"><span class="rise mono clock" class:go={remaining !== null && remaining <= 0}>{countdown}</span></span>
      </div>
    {/if}
  </div>
</div>

<style>
  .col {
    top: 200px !important;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 30px;
    padding: 0 4px 18px;
  }
  .title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .head .lab {
    font-size: 17px;
  }
  .teams {
    display: flex;
    height: 340px;
    margin: 3px 0;
  }
  .side {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
    min-width: 0;
  }
  .side.away {
    flex-direction: row-reverse;
  }
  .stripe {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    background: var(--c);
    transform-origin: 50% 0;
  }
  .away .stripe {
    left: auto;
    right: 0;
    transform-origin: 50% 100%;
  }
  /* Halo de la couleur de l'équipe, qui vient de son bord. */
  .glow {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, color-mix(in srgb, var(--c) 34%, transparent), transparent 62%);
  }
  .away .glow {
    transform: scaleX(-1);
  }
  .side > :not(i) {
    position: relative;
  }
  .side .chip {
    width: 168px;
    height: 168px;
  }
  .name {
    font-weight: 900;
  }
  .mid {
    position: relative;
    width: 1px;
    display: grid;
    place-items: center;
  }
  .mid i {
    position: absolute;
    top: 40px;
    bottom: 40px;
    width: 1px;
    background: var(--hair);
  }
  .mid b {
    position: relative;
    padding: 10px 0;
    background: #0d0f13;
    color: var(--ac);
    font-size: 16px;
  }
  .count {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 34px;
    height: 130px;
    margin: 3px auto 0;
    width: 620px;
  }
  .count .lab {
    font-size: 16px;
    color: var(--ac);
  }
  .clock {
    font-size: 78px;
    font-weight: 800;
  }
  .clock.go {
    font-family: inherit;
    font-size: 54px;
  }

  /* Vertical : une équipe par ligne, le « vs » sur le trait qui les sépare. */
  :global(.tall) .col {
    top: var(--safe-top) !important;
  }
  :global(.tall) .head {
    flex-direction: column;
    gap: 12px;
  }
  :global(.tall) .teams {
    flex-direction: column;
    height: 620px;
  }
  :global(.tall) .side,
  :global(.tall) .side.away {
    flex-direction: row;
    justify-content: flex-start;
    padding-left: 70px;
    gap: 44px;
  }
  :global(.tall) .away .stripe {
    left: 0;
    right: auto;
  }
  :global(.tall) .away .glow {
    transform: none;
  }
  :global(.tall) .mid {
    width: auto;
    height: 1px;
  }
  :global(.tall) .mid i {
    top: 0;
    bottom: auto;
    left: 40px;
    right: 40px;
    width: auto;
    height: 1px;
  }
  :global(.tall) .mid b {
    padding: 0 16px;
  }
  :global(.tall) .count {
    flex-direction: column;
    gap: 14px;
    height: 190px;
    width: 100%;
  }
</style>
