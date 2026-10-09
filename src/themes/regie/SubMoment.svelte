<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { PlayerRef, TeamConfig } from '../../shared/types';
  import { decode, fit, OUT } from './motion';
  import './regie.css';

  // Remplacement : l'entrant sur la grande ligne, le sortant en dessous, barré d'un trait qui se trace.
  let {
    playerIn,
    playerOut,
    team,
    minute,
    hurry = false,
    ondone,
  }: {
    playerIn: PlayerRef | null;
    playerOut: PlayerRef | null;
    team: TeamConfig;
    minute: string;
    hurry?: boolean;
    ondone?: () => void;
  } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline({ onComplete: () => ondone?.() })
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: OUT }, 0)
      .fromTo(q('.body'), { '--r': 0 }, { '--r': 1, duration: 0.45, ease: OUT }, 0.18)
      .fromTo(q('.tab'), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: OUT, transformOrigin: '0 50%' }, 0.24)
      .fromTo(q('.tab .chip'), { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, 0.42)
      .fromTo(q('.head .rise, .out .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.5, ease: OUT, stagger: 0.05 }, 0.34)
      .fromTo(q('.out .arrow'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 }, 0.5)
      .fromTo(q('.in .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.06 }, 0.8)
      .fromTo(q('.in .name'), { letterSpacing: '0.16em' }, { letterSpacing: '0.01em', duration: 0.9, ease: OUT }, 0.8)
      .fromTo(q('.in .arrow'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2.5)' }, 0.85)
      .call(() => q('.num').forEach((n) => decode(n)), [], 0.85)
      .fromTo(q('.strike'), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power3.inOut' }, 1.2)
      .to(q('.out .who'), { opacity: 0.45, duration: 0.4 }, 1.25)
      .addLabel('out', 4.6)
      .to(q('.rise'), { yPercent: -115, duration: 0.28, ease: 'power3.in', stagger: 0.015 }, 'out')
      .to(q('.arrow, .strike, .tab .chip'), { opacity: 0, duration: 0.2 }, 'out')
      .to(q('.body'), { '--r': 0, duration: 0.4, ease: 'expo.inOut' }, 'out+=0.2')
      .to(q('.rule'), { scaleX: 0, duration: 0.35, ease: 'expo.in' }, 'out+=0.4')
      .set(root, { autoAlpha: 0 }, 'out+=0.8');
    return () => tl?.kill();
  });

  $effect(() => {
    if (hurry && tl && tl.time() < tl.labels.out) tl.play('out');
  });
</script>

<div class="regie mo l3" bind:this={root} style:--c={team.color} style:--fs="{tall ? fit(playerIn?.name ?? '', 48, 800) : 48}px">
  <div class="rule"></div>
  <div class="body sheet">
    <div class="tab"><span class="chip" class:light={team.logoOnLight}><img src={team.logo} alt="" /></span></div>
    <div class="txt">
      <div class="head"><span class="up"><span class="rise lab">Remplacement<b class="mono">{minute}</b></span></span></div>
      {#if playerIn}
        <div class="line in">
          <i class="arrow up-a"></i>
          <span class="up"><span class="rise mono num">{playerIn.number}</span></span>
          <span class="up"><span class="rise name">{playerIn.name}</span></span>
        </div>
      {/if}
      {#if playerOut}
        <div class="line out">
          <i class="arrow down-a"></i>
          <span class="who">
            <span class="up"><span class="rise mono num">{playerOut.number}</span></span>
            <span class="up"><span class="rise name">{playerOut.name}</span></span>
            <i class="strike"></i>
          </span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .l3 {
    min-width: 520px;
    width: max-content;
  }
  .body {
    display: flex;
    min-height: 106px;
  }
  .tab {
    width: 96px;
    display: grid;
    place-items: center;
    background: var(--c);
    flex: none;
  }
  .tab .chip {
    width: 58px;
    height: 58px;
  }
  .txt {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 9px;
    padding: 18px 44px 18px 26px;
  }
  .head b {
    margin-left: 14px;
    color: var(--tx);
  }
  .line {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .in {
    font-size: var(--fs);
    font-weight: 800;
  }
  .in .num {
    font-size: 0.82em;
    color: var(--ac);
  }
  .out {
    font-size: 27px;
    color: var(--mut);
  }
  .out .num {
    font-size: 0.86em;
  }
  .who {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .strike {
    position: absolute;
    left: -6px;
    right: -6px;
    top: 50%;
    height: 2px;
    background: var(--alert);
    transform-origin: 0 50%;
  }
  .arrow {
    width: 0;
    height: 0;
    flex: none;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
  }
  .up-a {
    border-bottom: 15px solid #35d683;
  }
  .down-a {
    border-top: 11px solid var(--alert);
    border-left-width: 7px;
    border-right-width: 7px;
    margin: 0 3px;
  }
  :global(.tall) .l3 {
    min-width: 0;
  }
</style>
