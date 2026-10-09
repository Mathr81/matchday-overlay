<script lang="ts">
  import gsap from 'gsap';
  import qrcode from 'qrcode-generator';
  import { getContext, onMount } from 'svelte';
  import type { Banner } from '../../shared/types';
  import { fit, letters, OUT } from './motion';
  import './tigre.css';

  // Bandeau libre : reste affiché tant qu'on ne le retire pas. Avec un lien, un QR code est posé à gauche.
  let { banner, leaving, ongone }: { banner: Banner; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  /** Tracé SVG du QR code : un petit carré par module sombre. */
  const qr = $derived.by(() => {
    if (!banner.qr) return null;
    const code = qrcode(0, 'M');
    code.addData(banner.qr);
    code.make();
    const size = code.getModuleCount();
    let path = '';
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (code.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { size, path };
  });

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.qr'), { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.8)' }, 0)
      .fromTo(q('.main'), { '--p': 0 }, { '--p': 1, duration: 0.65, ease: OUT }, 0.08)
      .fromTo(q('.main .ch > span'), { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.014 }, 0.25)
      .fromTo(q('.main'), { '--wd': 60 }, { '--wd': 92, duration: 1, ease: OUT }, 0.25)
      .fromTo(q('.claws i'), { scaleY: 0 }, { scaleY: 1, duration: 0.35, ease: 'back.out(2.4)', stagger: 0.07 }, 0.5)
      .fromTo(q('.sub'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT }, 0.45)
      .fromTo(q('.sub > *'), { x: -22, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35 }, 0.6);
    return () => tl?.kill();
  });

  $effect(() => {
    if (!leaving) return;
    const q = gsap.utils.selector(root);
    tl?.kill();
    tl = gsap
      .timeline({ onComplete: ongone })
      .to(q('.main .ch > span'), { yPercent: -115, duration: 0.28, ease: 'power3.in', stagger: 0.006 }, 0)
      .to(q('.claws i'), { scaleY: 0, duration: 0.2, ease: 'power2.in', stagger: -0.04 }, 0)
      .to(q('.qr'), { scale: 0, duration: 0.3, ease: 'back.in(1.8)' }, 0)
      .to(q('.sub, .main'), { '--q': 1, duration: 0.45, ease: 'expo.inOut', stagger: 0.06 }, 0.12)
      .set(root, { autoAlpha: 0 });
  });
</script>

<div
  class="tigre mo free"
  bind:this={root}
  style:--fs="{tall ? fit(banner.title, 50, 1250) : 50}px"
  style:--fs2="{tall ? Math.max(15, fit(banner.subtitle ?? '', 21, 1500)) : 21}px"
>
  {#if qr}
    <div class="qr"><svg viewBox="-2 -2 {qr.size + 4} {qr.size + 4}" shape-rendering="crispEdges"><path d={qr.path} /></svg></div>
  {/if}
  <div>
    <div class="r1">
      <div class="main para hatch">{#each letters(banner.title) as c, i (i)}<span class="ch"><span>{c}</span></span>{/each}</div>
      <div class="claws"><i></i><i></i><i></i></div>
    </div>
    {#if banner.subtitle}<div class="sub para"><span>{banner.subtitle}</span></div>{/if}
  </div>
</div>

<style>
  .free {
    display: flex;
    align-items: flex-end;
    gap: 22px;
  }
  .qr {
    width: 146px;
    height: 146px;
    background: #fff;
    border-radius: 8px;
    flex: none;
  }
  .qr svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: var(--k);
  }
  .r1 {
    display: flex;
    position: relative;
    width: max-content;
  }
  .main {
    height: 96px;
    --s: 24px;
    background-color: var(--k);
    padding: 0 64px 0 56px;
    display: flex;
    align-items: center;
    font-size: var(--fs);
    white-space: nowrap;
  }
  .claws {
    position: absolute;
    left: 100%;
    bottom: 0;
    display: flex;
    gap: 8px;
    align-items: flex-end;
    margin-left: -6px;
  }
  .claws i {
    width: 11px;
    background: var(--o);
    transform: skewX(-14deg);
    transform-origin: 50% 100%;
  }
  .claws i:nth-child(1) {
    height: 96px;
  }
  .claws i:nth-child(2) {
    height: 64px;
  }
  .claws i:nth-child(3) {
    height: 32px;
  }
  .sub {
    height: 44px;
    --s: 11px;
    background: var(--o);
    color: var(--k);
    margin: 6px 0 0 -13px;
    padding: 0 34px 0 30px;
    display: inline-flex;
    align-items: center;
    font-size: var(--fs2);
    font-weight: 800;
    letter-spacing: 0.08em;
    --wd: 85;
    white-space: nowrap;
  }
  /* Vertical : le QR code passe au-dessus du texte. */
  :global(.tall) .free {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  :global(.tall) .qr {
    width: 190px;
    height: 190px;
    margin-left: 30px;
  }
</style>
