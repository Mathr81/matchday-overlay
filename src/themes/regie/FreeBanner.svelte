<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { Banner } from '../../shared/types';
  import { fit, qrPath } from '../util';
  import { OUT } from './motion';
  import './regie.css';

  // Bandeau libre : reste affiché tant qu'on ne le retire pas. Avec un lien, le QR code occupe l'onglet.
  let { banner, leaving, ongone }: { banner: Banner; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const qr = $derived(banner.qr ? qrPath(banner.qr) : null);
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: OUT }, 0)
      .fromTo(q('.body'), { '--r': 0 }, { '--r': 1, duration: 0.45, ease: OUT }, 0.18)
      .fromTo(q('.qr'), { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.45, ease: OUT }, 0.36)
      .fromTo(q('.mark'), { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: OUT, transformOrigin: '50% 0' }, 0.3)
      .fromTo(q('.rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.08 }, 0.36)
      .fromTo(q('.title'), { letterSpacing: '0.12em' }, { letterSpacing: '0.01em', duration: 0.9, ease: OUT }, 0.36);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    const q = gsap.utils.selector(root);
    tl?.kill();
    tl = gsap
      .timeline({ onComplete: ongone })
      .to(q('.rise'), { yPercent: -115, duration: 0.28, ease: 'power3.in', stagger: 0.03 }, 0)
      .to(q('.qr'), { opacity: 0, duration: 0.2 }, 0)
      .to(q('.body'), { '--r': 0, duration: 0.4, ease: 'expo.inOut' }, 0.15)
      .to(q('.rule'), { scaleX: 0, duration: 0.35, ease: 'expo.in' }, 0.35)
      .set(root, { autoAlpha: 0 });
  });
</script>

<div
  class="regie mo free"
  bind:this={root}
  style:--fs="{tall ? fit(banner.title, 42, qr ? 1100 : 1350) : 42}px"
  style:--fs2="{tall ? Math.max(13, fit(banner.subtitle ?? '', 17, qr ? 1150 : 1400)) : 17}px"
>
  <div class="rule"></div>
  <div class="body sheet" class:with-qr={qr}>
    {#if qr}
      <div class="qr"><svg viewBox="-2 -2 {qr.size + 4} {qr.size + 4}" shape-rendering="crispEdges"><path d={qr.path} /></svg></div>
    {:else}
      <i class="mark"></i>
    {/if}
    <div class="txt">
      <span class="up"><span class="rise title">{banner.title}</span></span>
      {#if banner.subtitle}<span class="up"><span class="rise lab sub">{banner.subtitle}</span></span>{/if}
    </div>
  </div>
</div>

<style>
  .free {
    width: max-content;
  }
  .body {
    display: flex;
    min-height: 96px;
  }
  .mark {
    width: 5px;
    background: var(--ac);
    flex: none;
  }
  .qr {
    width: 132px;
    height: 132px;
    background: #fff;
    flex: none;
  }
  .qr svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: #0d0f13;
  }
  .txt {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
    padding: 0 44px 0 28px;
  }
  .title {
    font-size: var(--fs);
    font-weight: 800;
  }
  .sub {
    font-size: var(--fs2);
    letter-spacing: 0.12em;
  }
</style>
