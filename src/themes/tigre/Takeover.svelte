<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { TeamConfig } from '../../shared/types';
  import { inkOn, OUT } from './motion';
  import './tigre.css';

  // Plein écran : bande inclinée aux couleurs de l'équipe, mot géant qui s'étire, blason qui claque.
  let {
    word,
    team,
    marquee,
    fontSize = 350,
    width = 150,
    x = 470,
    crestX = 1440,
    hold = 2.2,
    tallFit = { fontSize: 300, width: 110, x: 400, crestX: 1040 },
    onexit,
    ondone,
  }: {
    word: string;
    team: TeamConfig;
    marquee: string;
    fontSize?: number;
    /** Largeur de police à l'arrivée (50 à 150). */
    width?: number;
    x?: number;
    crestX?: number;
    hold?: number;
    /** Mêmes réglages pour le format vertical, où la bande est plus courte. */
    tallFit?: { fontSize: number; width: number; x: number; crestX: number };
    /** Appelé quand le plein écran commence à sortir. */
    onexit?: () => void;
    ondone?: () => void;
  } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const g = $derived(tall ? tallFit : { fontSize, width, x, crestX });
  let root: HTMLDivElement;

  onMount(() => {
    const q = gsap.utils.selector(root);
    const { width } = g;
    const bands = q('.st1, .band, .st2');
    const tl = gsap
      .timeline({ onComplete: () => ondone?.() })
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.shade'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
      .fromTo(bands, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: OUT, transformOrigin: '0 50%', stagger: 0.06 }, 0)
      .fromTo(q('.marq'), { x: 0 }, { x: -700, duration: hold + 0.8, ease: 'none' }, 0)
      .fromTo(q('.main'), { '--wd': 50, x: -600, opacity: 0 }, { '--wd': width, x: 0, opacity: 1, duration: 0.75, ease: OUT }, 0.14)
      .fromTo(q('.echo'), { '--wd': 50, x: -600, opacity: 0 }, { '--wd': width, x: 0, opacity: 0.4, duration: 0.75, ease: OUT, stagger: 0.07 }, 0.21)
      .to(q('.echo'), { opacity: 0, x: 80, duration: 0.45, ease: 'power2.in', stagger: 0.06 }, 0.85)
      .fromTo(q('.crest .logo'), { scale: 2.8, rotation: -28, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.5)' }, 0.36)
      .fromTo(q('.ring'), { scale: 0.7, opacity: 0.9 }, { scale: 2.3, opacity: 0, duration: 0.75, ease: 'power2.out', immediateRender: false }, 0.52)
      .to(q('.main'), { x: 60, duration: hold - 0.9, ease: 'none' }, 0.9)
      .to(q('.main'), { '--wd': 50, x: 1100, opacity: 0, duration: 0.45, ease: 'power4.in' }, hold)
      .to(q('.crest .logo'), { scale: 0, rotation: 24, duration: 0.35, ease: 'back.in(1.7)' }, hold)
      .to(bands, { scaleX: 0, transformOrigin: '100% 50%', duration: 0.5, ease: 'expo.in', stagger: 0.05 }, hold + 0.1)
      .call(() => onexit?.(), [], hold + 0.25)
      .to(q('.shade'), { opacity: 0, duration: 0.4 }, hold + 0.3)
      .set(root, { autoAlpha: 0 }, hold + 0.8);
    return () => tl.kill();
  });
</script>

<div class="tigre tk" bind:this={root} style:--band={team.color} style:--ink={inkOn(team.color)} style:--fs="{g.fontSize}px" style:--x="{g.x}px" style:--cx="{g.crestX}px">
  <div class="shade"></div>
  <div class="rot">
    <div class="st1"></div>
    <div class="band"></div>
    <div class="st2">
      <div class="marq">
        {#each Array(8) as _, i (i)}<span>{marquee}</span><em>///</em>{/each}
      </div>
    </div>
    <div class="word echo">{word}</div>
    <div class="word echo">{word}</div>
    <div class="word main">{word}</div>
    <div class="crest">
      <div class="ring"></div>
      <div class="logo" class:chip={team.logoOnLight}><img src={team.logo} alt="" /></div>
    </div>
  </div>
</div>

<style>
  .tk {
    position: absolute;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .shade {
    position: absolute;
    inset: 0;
    background: radial-gradient(90% 80% at 50% 50%, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.72));
  }
  .rot {
    position: absolute;
    left: -240px;
    top: 300px;
    width: 2400px;
    height: 440px;
    transform: rotate(-8deg);
  }
  .st1 {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 20px;
    background: var(--w);
  }
  .band {
    position: absolute;
    left: 0;
    right: 0;
    top: 34px;
    height: 340px;
    background-color: var(--band);
    background-image: repeating-linear-gradient(104deg, rgba(0, 0, 0, 0.075) 0 3px, transparent 3px 18px);
  }
  .st2 {
    position: absolute;
    left: 0;
    right: 0;
    top: 388px;
    height: 52px;
    background: var(--k);
    overflow: hidden;
  }
  .marq {
    position: absolute;
    left: 0;
    top: 0;
    white-space: nowrap;
    font-size: 26px;
    line-height: 54px;
    font-weight: 800;
    letter-spacing: 0.16em;
    --wd: 88;
  }
  .marq em {
    color: var(--o);
    font-style: inherit;
    margin: 0 22px;
  }
  .word {
    position: absolute;
    left: var(--x);
    top: 34px;
    height: 340px;
    display: flex;
    align-items: center;
    white-space: nowrap;
    padding-top: 0.04em;
    font-size: var(--fs);
    letter-spacing: -0.01em;
    color: var(--ink);
    --wd: 150;
  }
  .crest {
    position: absolute;
    left: var(--cx);
    top: 24px;
    width: 360px;
    height: 360px;
  }
  .logo {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
  }
  .logo img {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }
  .logo.chip {
    background: var(--w);
    border-radius: 50%;
    transform-origin: 50% 50%;
    width: 280px;
    height: 280px;
    margin: 40px;
  }
  .logo.chip img {
    max-width: 62%;
    max-height: 62%;
  }
  .ring {
    position: absolute;
    inset: 40px;
    border: 10px solid var(--w);
    border-radius: 50%;
    opacity: 0;
  }

  /* Vertical : bande plus inclinée, blason posé à cheval sur son bord haut. */
  :global(.tall) .rot {
    left: -300px;
    top: 720px;
    width: 1700px;
    transform: rotate(-12deg);
  }
  :global(.tall) .crest {
    top: -170px;
    width: 300px;
    height: 300px;
  }
  :global(.tall) .logo.chip {
    width: 230px;
    height: 230px;
    margin: 35px;
  }
  :global(.tall) .ring {
    inset: 35px;
  }
</style>
