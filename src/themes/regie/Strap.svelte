<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { TeamConfig } from '../../shared/types';
  import { fit, inkOn, OUT } from './motion';
  import './regie.css';

  // Grand bandeau sur toute la largeur : deux traits partent en sens opposés, la bande s'ouvre entre eux,
  // le mot arrive lettres écartées puis se resserre. À la sortie tout se replie vers la gauche,
  // là où le bandeau du buteur prend le relais.
  let {
    word,
    team,
    kicker,
    line,
    note = '',
    center = false,
    hold = 2.3,
    onexit,
    ondone,
  }: {
    word: string;
    team: TeamConfig;
    kicker: string;
    line: string;
    note?: string;
    /** Au milieu de l'écran et plus haut : pour l'annonce du vainqueur. */
    center?: boolean;
    hold?: number;
    /** Appelé quand le bandeau commence à sortir. */
    onexit?: () => void;
    ondone?: () => void;
  } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  let root: HTMLDivElement;

  onMount(() => {
    const q = gsap.utils.selector(root);
    const tl = gsap
      .timeline({ onComplete: () => ondone?.() })
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.shade'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.r1'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: OUT, transformOrigin: '0 50%' }, 0)
      .fromTo(q('.r2'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: OUT, transformOrigin: '100% 50%' }, 0.06)
      .fromTo(q('.band'), { '--o': 0 }, { '--o': 1, duration: 0.5, ease: OUT }, 0.16)
      .fromTo(q('.block'), { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: OUT, transformOrigin: '0 50%' }, 0.22)
      .fromTo(q('.block .chip'), { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.44)
      .fromTo(q('.word'), { letterSpacing: '0.6em', opacity: 0 }, { letterSpacing: '0.02em', opacity: 1, duration: 0.9, ease: OUT }, 0.3)
      .fromTo(q('.link'), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: OUT, transformOrigin: '0 50%' }, 0.5)
      .fromTo(q('.info .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.09 }, 0.55)
      .fromTo(q('.sweep'), { xPercent: -120 }, { xPercent: 520, duration: 1.3, ease: 'power2.inOut' }, 0.4)
      .to(q('.word'), { letterSpacing: '0.05em', duration: Math.max(0.1, hold - 1.2), ease: 'none' }, 1.2)
      .to(q('.info .rise'), { yPercent: -115, duration: 0.28, ease: 'power3.in', stagger: 0.03 }, hold)
      .to(q('.word'), { opacity: 0, x: -60, duration: 0.3, ease: 'power3.in' }, hold)
      .to(q('.block .chip'), { scale: 0, duration: 0.25, ease: 'power2.in' }, hold)
      .to(q('.link'), { scaleX: 0, duration: 0.3, ease: 'power3.in', transformOrigin: '100% 50%' }, hold)
      .to(q('.block'), { scaleX: 0, duration: 0.4, ease: 'expo.inOut' }, hold + 0.12)
      .to(q('.band'), { '--o': 0, duration: 0.4, ease: 'expo.inOut' }, hold + 0.2)
      .call(() => onexit?.(), [], hold + 0.3)
      .to(q('.r1, .r2'), { scaleX: 0, duration: 0.4, ease: 'expo.in', transformOrigin: '0 50%' }, hold + 0.38)
      .to(q('.shade'), { opacity: 0, duration: 0.4 }, hold + 0.3)
      .set(root, { autoAlpha: 0 }, hold + 0.85);
    return () => tl.kill();
  });
</script>

<div class="regie strap" class:center bind:this={root} style:--c={team.color} style:--ink={inkOn(team.color)} style:--ws="{tall ? fit(word, center ? 120 : 150, 760) : center ? 150 : 132}px">
  <div class="shade"></div>
  <div class="frame">
    <div class="rule r1"></div>
    <div class="band">
      <div class="block"><span class="chip" class:light={team.logoOnLight}><img src={team.logo} alt="" /></span></div>
      <div class="word">{word}</div>
      <i class="link"></i>
      <div class="info">
        <span class="up"><span class="rise lab">{kicker}</span></span>
        <span class="up"><span class="rise line">{line}</span></span>
        {#if note}<span class="up"><span class="rise lab note">{note}</span></span>{/if}
      </div>
      <i class="sweep"></i>
    </div>
    <div class="rule r2"></div>
  </div>
</div>

<style>
  .strap {
    position: absolute;
    inset: 0;
    visibility: hidden;
  }
  .shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(transparent 35%, rgba(5, 7, 10, 0.6));
  }
  .center .shade {
    background: rgba(5, 7, 10, 0.62);
  }
  .frame {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 84px;
  }
  .center .frame {
    bottom: auto;
    top: 50%;
    transform: translateY(-50%);
  }
  /* La bande s'ouvre du milieu vers ses deux traits. */
  .band {
    position: relative;
    display: flex;
    align-items: center;
    height: 168px;
    margin: 3px 0;
    background: var(--bg);
    clip-path: inset(calc((1 - var(--o, 1)) * 50%) 0);
    overflow: hidden;
  }
  .center .band {
    height: 240px;
  }
  .block {
    align-self: stretch;
    width: 250px;
    display: grid;
    place-items: center;
    background: var(--c);
    flex: none;
  }
  .block .chip {
    width: 112px;
    height: 112px;
  }
  .center .block {
    width: 330px;
  }
  .center .block .chip {
    width: 160px;
    height: 160px;
  }
  .word {
    margin-left: 56px;
    font-size: var(--ws);
    font-weight: 900;
    --wd: 100;
    white-space: nowrap;
  }
  /* Filet qui relie le mot au détail, à l'autre bout de la bande. */
  .link {
    flex: 1;
    height: 1px;
    margin: 0 48px 0 56px;
    background: var(--hair);
  }
  .info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    padding-right: 84px;
    text-align: right;
  }
  .lab {
    font-size: 17px;
    color: var(--ac);
  }
  .line {
    font-size: 52px;
    font-weight: 800;
  }
  .center .line {
    font-size: 60px;
  }
  .note {
    color: var(--mut);
  }
  /* Reflet qui traverse la bande une fois. */
  .sweep {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 24%;
    background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.07), transparent);
    pointer-events: none;
  }

  /* Vertical : l'aplat de couleur à gauche, le mot et le détail empilés à droite. */
  :global(.tall) .frame {
    bottom: var(--safe-bottom);
  }
  :global(.tall) .center .frame {
    bottom: auto;
    top: 46%;
  }
  :global(.tall) .band {
    height: 300px;
    flex-wrap: wrap;
    align-content: center;
    column-gap: 0;
    padding-left: 210px;
  }
  :global(.tall) .center .band {
    height: 380px;
  }
  :global(.tall) .block {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 170px;
  }
  :global(.tall) .block .chip {
    width: 104px;
    height: 104px;
  }
  :global(.tall) .word {
    margin-left: 0;
    width: 100%;
  }
  :global(.tall) .link {
    display: none;
  }
  :global(.tall) .info {
    margin: 18px 0 0;
    padding-right: 0;
    align-items: flex-start;
    text-align: left;
    gap: 10px;
  }
  :global(.tall) .line {
    font-size: 40px;
  }
</style>
