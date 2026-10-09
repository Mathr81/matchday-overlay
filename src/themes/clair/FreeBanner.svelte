<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { Banner } from '../../shared/types';
  import { fit, qrPath } from '../util';
  import { OUT, POP, softFrom, softTo } from './motion';
  import './clair.css';

  // Bandeau libre : reste affiché tant qu'on ne le retire pas. Avec un lien, le QR code est posé dans une carte à gauche.
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
      .fromTo(q('.qr'), { scale: 0, rotation: -14 }, { scale: 1, rotation: -3, duration: 0.6, ease: 'back.out(2)' }, 0)
      .fromTo(q('.main'), { '--o': 0 }, { '--o': 1, duration: 0.65, ease: OUT }, 0.05)
      .fromTo(q('.main'), { scale: 0.5 }, { scale: 1, duration: 0.65, ease: 'back.out(1.5)' }, 0.05)
      .fromTo(q('.tx'), softFrom, softTo, 0.3)
      .fromTo(q('.sub'), { scale: 0.6, y: -22, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: POP }, 0.5);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    const q = gsap.utils.selector(root);
    tl?.kill();
    tl = gsap
      .timeline({ onComplete: ongone })
      .to(q('.sub'), { scale: 0.6, y: -22, opacity: 0, duration: 0.25, ease: 'back.in(2)' }, 0)
      .to(q('.tx'), { opacity: 0, duration: 0.2 }, 0)
      .to(q('.qr'), { scale: 0, duration: 0.3, ease: 'back.in(1.8)' }, 0)
      .to(q('.main'), { '--o': 0, scale: 0.6, duration: 0.35, ease: 'expo.in' }, 0.12)
      .set(root, { autoAlpha: 0 });
  });
</script>

<div
  class="clair mo free"
  class:tall-qr={tall && qr}
  bind:this={root}
  style:--fs="{fit(banner.title, 44, tall ? 1250 : 2300)}px"
  style:--fs2="{Math.max(14, fit(banner.subtitle ?? '', 19, tall ? 1500 : 3000))}px"
>
  <div class="row">
    {#if qr}
      <div class="qr"><svg viewBox="-2 -2 {qr.size + 4} {qr.size + 4}" shape-rendering="crispEdges"><path d={qr.path} /></svg></div>
    {/if}
    <div class="stack">
      <div class="main pill"><span class="tx">{banner.title}</span></div>
      {#if banner.subtitle}<div class="sub cap">{banner.subtitle}</div>{/if}
    </div>
  </div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .qr {
    width: 150px;
    height: 150px;
    padding: 8px;
    box-sizing: border-box;
    background: #fff;
    border-radius: 26px;
    flex: none;
  }
  .qr svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: var(--ink);
  }
  .stack {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .main {
    display: flex;
    align-items: center;
    height: 92px;
    padding: 0 48px;
    font-size: var(--fs);
    font-weight: 800;
    white-space: nowrap;
  }
  .sub {
    height: 40px;
    padding: 0 24px;
    margin-top: -9px;
    font-size: var(--fs2);
    font-weight: 600;
  }
  /* Vertical : le QR code passe au-dessus. */
  .tall-qr .row {
    flex-direction: column;
    gap: 14px;
  }
  .tall-qr .qr {
    width: 190px;
    height: 190px;
  }
</style>
