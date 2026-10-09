<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { TeamConfig } from '../../shared/types';
  import { fit, inkOn, onLight, OUT, POP, softFrom, softTo, SPRING } from './motion';
  import './clair.css';

  // Bandeau centré en bas : la pastille s'ouvre depuis son milieu, le disque rebondit,
  // l'étiquette de couleur se pose de travers dessus, le détail tombe dessous.
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
    /** Couleur de l'étiquette : celle de l'équipe, ou le rouge d'alerte. */
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
      .fromTo(q('.main'), { '--o': 0 }, { '--o': 1, duration: 0.65, ease: OUT }, 0)
      .fromTo(q('.main'), { scale: 0.5 }, { scale: 1, duration: 0.65, ease: 'back.out(1.5)' }, 0)
      .fromTo(q('.disc'), { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.9, ease: SPRING }, 0.15)
      .fromTo(q('.tx'), softFrom, { ...softTo, stagger: 0.08 }, 0.28)
      .fromTo(q('.tag'), { scale: 0, rotation: -22 }, { scale: 1, rotation: -3, duration: 0.55, ease: 'back.out(2.4)' }, 0.34)
      .fromTo(q('.meta'), { scale: 0.6, y: -22, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: POP }, 0.55)
      .addLabel('out', hold)
      .to(q('.meta'), { scale: 0.6, y: -22, opacity: 0, duration: 0.25, ease: 'back.in(2)' }, 'out')
      .to(q('.tag'), { scale: 0, rotation: 14, duration: 0.25, ease: 'back.in(2)' }, 'out')
      .to(q('.tx'), { opacity: 0, duration: 0.2 }, 'out')
      .to(q('.disc'), { scale: 0, duration: 0.3, ease: 'back.in(1.8)' }, 'out+=0.05')
      .to(q('.main'), { '--o': 0, scale: 0.6, duration: 0.35, ease: 'expo.in' }, 'out+=0.18')
      .set(root, { autoAlpha: 0 }, 'out+=0.6');
    return () => tl?.kill();
  });

  $effect(() => {
    if (hurry && tl && tl.time() < tl.labels.out) tl.play('out');
  });
</script>

<div class="clair mo" bind:this={root} style:--c={team.color} style:--t={color} style:--tink={inkOn(color)} style:--lit={onLight(color)} style:--fs="{fit(name, 54, tall ? 880 : 1500)}px">
  <div class="stack">
  <div class="tag"><b>{tag}</b>{#if sub}<span>{sub}</span>{/if}</div>
  <div class="main pill">
    <span class="disc" class:light={team.logoOnLight}><img src={team.logo} alt="" /></span>
    {#if number !== null}<span class="num tx">{number}</span>{/if}
    <span class="name tx">{name}</span>
  </div>
  {#if metaLabel || metaValue}
    <div class="meta cap"><span>{metaLabel}</span>{#if metaValue}<b>{metaValue}</b>{/if}</div>
  {/if}
  </div>
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .tag {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: baseline;
    gap: 10px;
    height: 40px;
    line-height: 40px;
    padding: 0 20px;
    margin: 0 0 -12px 76px;
    border-radius: 999px;
    background: var(--t);
    color: var(--tink);
    font-size: 21px;
    font-weight: 800;
    white-space: nowrap;
  }
  .tag span {
    font-size: 17px;
    font-weight: 600;
    opacity: 0.8;
  }
  .main {
    display: flex;
    align-items: center;
    gap: 22px;
    height: 104px;
    padding: 0 50px 0 11px;
    white-space: nowrap;
  }
  .disc {
    width: 82px;
    height: 82px;
  }
  .num {
    font-size: calc(var(--fs) * 0.9);
    font-weight: 800;
    color: var(--lit);
  }
  .name {
    font-size: var(--fs);
    font-weight: 800;
  }
  .meta {
    gap: 12px;
    height: 38px;
    padding: 0 22px;
    margin: -9px 0 0 108px;
    font-size: 17px;
    font-weight: 600;
  }
  .meta span {
    opacity: 0.7;
  }
  .meta b {
    font-weight: 800;
  }
</style>
