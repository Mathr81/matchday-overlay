<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { TeamConfig } from '../../shared/types';
  import { confetti, fit, letters, onLight, POP, softFrom, softTo, SPRING } from './motion';
  import './clair.css';

  // Fête au centre de l'écran : un grand disque à la couleur de l'équipe gonfle, le logo rebondit dedans,
  // le mot arrive lettre par lettre dans une pastille blanche et des confettis partent en éventail.
  let {
    word,
    team,
    line,
    note = '',
    bursts = 1,
    hold = 2.3,
    onexit,
    ondone,
  }: {
    word: string;
    team: TeamConfig;
    line: string;
    note?: string;
    /** Nombre de salves de confettis. */
    bursts?: number;
    hold?: number;
    /** Appelé quand la fête commence à sortir. */
    onexit?: () => void;
    ondone?: () => void;
  } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const palette = $derived([team.color, '#ffffff', onLight(team.color), '#14161a', '#ffd43b']);
  let root: HTMLDivElement;

  onMount(() => {
    const q = gsap.utils.selector(root);
    const tl = gsap
      .timeline({ onComplete: () => ondone?.() })
      .set(root, { autoAlpha: 1 })
      .set(q('.word, .line, .note'), { xPercent: -50 })
      .fromTo(q('.veil'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
      .fromTo(q('.ball'), { scale: 0 }, { scale: 1, duration: 1, ease: SPRING }, 0)
      .fromTo(q('.ripple'), { scale: 0.5, opacity: 0.85 }, { scale: 2.5, opacity: 0, duration: 1.1, ease: 'power2.out', stagger: 0.18 }, 0.05)
      .fromTo(q('.ball img'), { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.2)' }, 0.18)
      .fromTo(q('.word'), { scale: 0 }, { scale: 1, duration: 0.55, ease: POP }, 0.28)
      .fromTo(
        q('.ch'),
        { y: 70, scale: 0.2, rotation: (i: number) => (i % 2 ? 24 : -24), opacity: 0 },
        { y: 0, scale: 1, rotation: 0, opacity: 1, duration: 0.9, ease: SPRING, stagger: 0.05 },
        0.36,
      )
      .fromTo(q('.line'), { scale: 0.5, y: -24, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: POP }, 0.62)
      .fromTo(q('.note'), softFrom, softTo, 0.8)
      .to(q('.ball'), { y: -10, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: Math.max(1, Math.round((hold - 1) / 0.9)) }, 1);
    const pieces = q('.cf');
    const per = Math.floor(pieces.length / bursts);
    for (let b = 0; b < bursts; b++) confetti(tl, pieces.slice(b * per, (b + 1) * per), 0.3 + b * 1.1, tall ? 470 : 640);
    tl.to(q('.note, .line'), { scale: 0.5, opacity: 0, duration: 0.22, ease: 'back.in(2)' }, hold)
      .to(q('.word'), { scale: 0, duration: 0.3, ease: 'back.in(1.8)' }, hold + 0.05)
      .to(q('.ball'), { scale: 0, duration: 0.4, ease: 'back.in(1.6)' }, hold + 0.12)
      .call(() => onexit?.(), [], hold + 0.3)
      .to(q('.veil'), { opacity: 0, duration: 0.4 }, hold + 0.2)
      .set(root, { autoAlpha: 0 }, hold + 0.7);
    return () => tl.kill();
  });
</script>

<div class="clair burst" bind:this={root} style:--c={team.color} style:--ws="{fit(word, tall ? 150 : 180, tall ? 1250 : 2400)}px">
  <div class="veil"></div>
  <div class="center">
    <i class="ripple"></i><i class="ripple"></i>
    <div class="ball" class:light={team.logoOnLight}><img src={team.logo} alt="" /></div>
    <div class="cfs">
      {#each Array(bursts * 32) as _, i (i)}<i class="cf" class:long={i % 3 === 0} style:background={palette[i % palette.length]} style:width="{10 + (i % 4) * 4}px"></i>{/each}
    </div>
    <div class="word">{#each letters(word) as c, i (i)}<span class="ch">{c}</span>{/each}</div>
    <div class="line cap">{line}</div>
    {#if note}<div class="note">{note}</div>{/if}
  </div>
</div>

<style>
  .burst {
    position: absolute;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .veil {
    position: absolute;
    inset: 0;
    background: radial-gradient(60% 60% at 50% 44%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.08));
  }
  /* Point d'ancrage au centre : tout est placé par rapport à lui. */
  .center {
    position: absolute;
    left: 50%;
    top: 42%;
    width: 0;
    height: 0;
    filter: drop-shadow(0 18px 30px rgba(16, 24, 40, 0.3));
  }
  .ball,
  .ripple {
    position: absolute;
    left: -210px;
    top: -210px;
    width: 420px;
    height: 420px;
    border-radius: 50%;
  }
  .ball {
    display: grid;
    place-items: center;
    background: var(--c);
  }
  .ball img {
    display: block;
    max-width: 62%;
    max-height: 62%;
  }
  .ball.light {
    background: #f4f5f7;
    box-shadow: inset 0 0 0 16px var(--c);
  }
  .ripple {
    border: 10px solid var(--c);
    box-sizing: border-box;
  }
  .word {
    position: absolute;
    left: 0;
    top: 96px;
    height: 1.18em;
    padding: 0 0.34em;
    display: flex;
    align-items: center;
    border-radius: 999px;
    background: var(--paper);
    font-size: var(--ws);
    font-weight: 800;
    font-stretch: 78%;
    white-space: nowrap;
  }
  .ch {
    display: inline-block;
  }
  .line {
    position: absolute;
    left: 0;
    top: calc(96px + var(--ws) * 1.18 - 14px);
    height: 58px;
    padding: 0 30px;
    font-size: 30px;
    font-weight: 800;
  }
  .note {
    position: absolute;
    left: 0;
    top: calc(96px + var(--ws) * 1.18 + 58px);
    height: 40px;
    padding: 0 22px;
    display: flex;
    align-items: center;
    border-radius: 999px;
    background: var(--paper);
    font-size: 20px;
    font-weight: 700;
    white-space: nowrap;
  }
  .cf {
    position: absolute;
    left: 0;
    top: 0;
    height: 14px;
    border-radius: 999px;
    opacity: 0;
  }
  .cf.long {
    height: 30px;
  }
  :global(.tall) .ball,
  :global(.tall) .ripple {
    left: -180px;
    top: -180px;
    width: 360px;
    height: 360px;
  }
  :global(.tall) .word {
    top: 80px;
  }
  :global(.tall) .line {
    top: calc(80px + var(--ws) * 1.18 - 14px);
    font-size: 27px;
  }
  :global(.tall) .note {
    top: calc(80px + var(--ws) * 1.18 + 58px);
  }
</style>
