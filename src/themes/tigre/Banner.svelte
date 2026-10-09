<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import { fit, inkOn, letters, OUT } from './motion';
  import './tigre.css';

  // Bandeau bas gauche : étiquette de couleur, nom qui s'étire, griffes, ligne de détail.
  let {
    tag,
    sub = '',
    number = null,
    name,
    metaLabel = '',
    metaValue = '',
    color,
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
    color: string;
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
    const chars = q('.name .ch > span');
    tl = gsap
      .timeline({ onComplete: () => ondone?.() })
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.tag'), { '--p': 0 }, { '--p': 1, duration: 0.45, ease: OUT }, 0)
      .fromTo(q('.main'), { '--p': 0 }, { '--p': 1, duration: 0.65, ease: OUT }, 0.08)
      .fromTo(q('.tag > *'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: OUT, stagger: 0.07 }, 0.12)
      .fromTo(q('.num'), { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: OUT }, 0.24)
      .fromTo(chars, { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.024 }, 0.28)
      .fromTo(q('.name'), { '--wd': 55 }, { '--wd': name.length > 16 ? 78 : 100, duration: 1, ease: OUT }, 0.28)
      .fromTo(q('.claws i'), { scaleY: 0 }, { scaleY: 1, duration: 0.35, ease: 'back.out(2.4)', stagger: 0.07 }, 0.5)
      .fromTo(q('.meta'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT }, 0.5)
      .fromTo(q('.meta > *'), { x: -22, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, stagger: 0.08 }, 0.64)
      .addLabel('out', hold)
      .to(chars, { yPercent: -115, duration: 0.3, ease: 'power3.in', stagger: 0.01 }, 'out')
      .to(q('.claws i'), { scaleY: 0, duration: 0.2, ease: 'power2.in', stagger: -0.04 }, 'out')
      .to(q('.num, .tag > *, .meta > *'), { opacity: 0, duration: 0.2 }, 'out+=0.1')
      .to(q('.meta, .main, .tag'), { '--q': 1, duration: 0.5, ease: 'expo.inOut', stagger: 0.06 }, 'out+=0.15')
      .set(root, { autoAlpha: 0 }, 'out+=0.9');
    return () => tl?.kill();
  });

  $effect(() => {
    if (hurry && tl && tl.time() < tl.labels.out) tl.play('out');
  });
</script>

<div class="tigre mo" bind:this={root} style:--c={color} style:--ink={inkOn(color)} style:--fs="{tall ? fit(name, 70, 1000) : 70}px">
  <div class="r1">
    <div class="tag para">
      <span class="k">{tag}</span>
      {#if sub}<span class="sub">{sub}</span>{/if}
    </div>
    <div class="mw">
      <div class="main para hatch">
        {#if number !== null}<span class="num">{number}</span>{/if}
        <span class="name">{#each letters(name) as c, i (i)}<span class="ch"><span>{c}</span></span>{/each}</span>
      </div>
      <div class="claws"><i></i><i></i><i></i></div>
    </div>
  </div>
  {#if metaLabel || metaValue}
    <div class="meta para">
      {#if metaLabel}<span>{metaLabel}</span>{/if}
      {#if metaValue}<b>{metaValue}</b>{/if}
    </div>
  {/if}
</div>

<style>
  .r1 {
    display: flex;
    width: max-content;
  }
  .mw {
    display: flex;
    position: relative;
  }
  .tag {
    height: 112px;
    --s: 28px;
    background: var(--c);
    color: var(--ink);
    padding: 0 50px 0 52px;
    margin-right: -20px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    white-space: nowrap;
  }
  .k {
    font-size: 46px;
    --wd: 105;
  }
  .sub {
    font-size: 22px;
    font-weight: 800;
    --wd: 80;
    opacity: 0.8;
  }
  .main {
    height: 112px;
    --s: 28px;
    background-color: var(--k);
    padding: 0 76px 0 58px;
    display: flex;
    align-items: center;
    gap: 22px;
  }
  .num {
    font-size: calc(var(--fs) * 1.23);
    color: var(--o);
    --wd: 70;
  }
  .name {
    font-size: var(--fs);
    white-space: nowrap;
  }
  .claws {
    position: absolute;
    left: 100%;
    bottom: 0;
    display: flex;
    gap: 9px;
    align-items: flex-end;
    margin-left: -6px;
  }
  .claws i {
    width: 12px;
    background: var(--o);
    transform: skewX(-14deg);
    transform-origin: 50% 100%;
  }
  .claws i:nth-child(1) {
    height: 112px;
  }
  .claws i:nth-child(2) {
    height: 74px;
  }
  .claws i:nth-child(3) {
    height: 38px;
  }
  .meta {
    height: 44px;
    --s: 11px;
    background: var(--w);
    color: var(--k);
    margin: 6px 0 0 -13px;
    padding: 0 34px 0 30px;
    display: inline-flex;
    gap: 14px;
    align-items: center;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.1em;
    --wd: 85;
  }
  .meta b {
    font-weight: 900;
  }

  /* Vertical : l'étiquette passe au-dessus du nom, chaque ligne décalée pour suivre l'inclinaison. */
  :global(.tall) .r1 {
    flex-direction: column;
    align-items: flex-start;
  }
  :global(.tall) .tag {
    height: 54px;
    --s: 13.5px;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    padding: 0 34px 0 32px;
    margin: 0 0 5px 30px;
  }
  :global(.tall) .k {
    font-size: 30px;
  }
  :global(.tall) .sub {
    font-size: 19px;
  }
  :global(.tall) .meta {
    margin-left: -13px;
  }
</style>
