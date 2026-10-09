<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { TeamConfig } from '../../shared/types';
  import { decode, fit, inkOn, onDark, OUT } from './motion';
  import './regie.css';

  // Bandeau bas gauche : le trait se trace, la surface se déplie, l'onglet de l'équipe s'ouvre, le nom monte.
  let {
    tag,
    sub = '',
    number = null,
    name,
    metaLabel = '',
    metaValue = '',
    color,
    team,
    hold = 4,
    hurry = false,
    ondone,
  }: {
    tag: string;
    sub?: string;
    number?: number | null;
    name: string;
    metaLabel?: string;
    metaValue?: string;
    /** Couleur de l'onglet et de l'étiquette : celle de l'équipe, ou le rouge d'alerte. */
    color: string;
    team: TeamConfig;
    hold?: number;
    /** Un autre moment attend : on passe tout de suite à la sortie. */
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
      .fromTo(q('.body .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.06 }, 0.34)
      .fromTo(q('.name'), { letterSpacing: '0.16em' }, { letterSpacing: '0.01em', duration: 0.9, ease: OUT }, 0.34)
      .call(() => decode(q('.num')[0]), [], 0.4)
      .fromTo(q('.meta'), { '--r': 0 }, { '--r': 1, duration: 0.4, ease: OUT }, 0.62)
      .fromTo(q('.meta .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.4, ease: OUT }, 0.72)
      .addLabel('out', hold)
      .to(q('.rise'), { yPercent: -115, duration: 0.28, ease: 'power3.in', stagger: 0.02 }, 'out')
      .to(q('.tab .chip'), { scale: 0, duration: 0.2, ease: 'power2.in' }, 'out')
      .to(q('.meta'), { '--r': 0, duration: 0.3, ease: 'expo.inOut' }, 'out+=0.1')
      .to(q('.body'), { '--r': 0, duration: 0.4, ease: 'expo.inOut' }, 'out+=0.2')
      .to(q('.rule'), { scaleX: 0, duration: 0.35, ease: 'expo.in' }, 'out+=0.4')
      .set(root, { autoAlpha: 0 }, 'out+=0.8');
    return () => tl?.kill();
  });

  $effect(() => {
    if (hurry && tl && tl.time() < tl.labels.out) tl.play('out');
  });
</script>

<div class="regie mo l3" bind:this={root} style:--c={color} style:--ink={inkOn(color)} style:--lit={onDark(color)} style:--fs="{tall ? fit(name, 54, 860) : 54}px">
  <div class="rule"></div>
  <div class="body sheet">
    <div class="tab"><span class="chip" class:light={team.logoOnLight}><img src={team.logo} alt="" /></span></div>
    <div class="txt">
      <div class="top">
        <span class="up"><span class="rise tag">{tag}</span></span>
        {#if sub}<span class="up"><span class="rise lab">{sub}</span></span>{/if}
      </div>
      <div class="who">
        {#if number !== null}<span class="up"><span class="rise mono num">{number}</span></span>{/if}
        <span class="up"><span class="rise name">{name}</span></span>
      </div>
    </div>
  </div>
  {#if metaLabel || metaValue}
    <div class="meta sheet">
      <span class="up"><span class="rise">{metaLabel}{#if metaValue}<b>{metaValue}</b>{/if}</span></span>
    </div>
  {/if}
</div>

<style>
  .l3 {
    min-width: 520px;
    width: max-content;
  }
  .body {
    display: flex;
    height: 106px;
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
    padding: 0 44px 0 26px;
  }
  .top {
    display: flex;
    align-items: baseline;
    gap: 14px;
  }
  .tag {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.16em;
    --wd: 100;
    font-variation-settings: 'wdth' 100;
    color: var(--lit);
  }
  .who {
    display: flex;
    align-items: baseline;
    gap: 18px;
  }
  .num {
    font-size: calc(var(--fs) * 0.82);
    color: var(--lit);
  }
  .name {
    font-size: var(--fs);
    font-weight: 800;
  }
  .meta {
    width: max-content;
    height: 38px;
    margin-left: 96px;
    padding: 0 26px;
    display: flex;
    align-items: center;
    background: var(--bg2);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.14em;
    --wd: 100;
    color: var(--mut);
  }
  .meta b {
    margin-left: 12px;
    font-weight: 800;
    color: var(--tx);
  }
  :global(.tall) .tab {
    width: 84px;
  }
  :global(.tall) .meta {
    margin-left: 84px;
  }
  :global(.tall) .l3 {
    min-width: 0;
  }
</style>
