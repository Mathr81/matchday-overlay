<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { PlayerRef, TeamConfig } from '../../shared/types';
  import { ALERT, decode, fit, OUT } from './motion';
  import './regie.css';

  // Le carton se retourne dans l'onglet. Deuxième jaune : un second carton glisse sur le premier,
  // puis les deux basculent au rouge et l'étiquette passe à « Expulsion ».
  let {
    color,
    player,
    team,
    minute,
    hurry = false,
    ondone,
  }: {
    color: 'yellow' | 'red' | 'second_yellow';
    player: PlayerRef | null;
    team: TeamConfig;
    minute: string;
    hurry?: boolean;
    ondone?: () => void;
  } = $props();

  const labels = { yellow: ['Carton jaune'], red: ['Carton rouge'], second_yellow: ['Deuxième carton jaune', 'Expulsion'] };
  const name = $derived(player?.name ?? team.name);
  const tall = getContext<boolean>('tall') ?? false;
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    const second = color === 'second_yellow';
    tl = gsap
      .timeline({ onComplete: () => ondone?.() })
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: OUT }, 0)
      .fromTo(q('.body'), { '--r': 0 }, { '--r': 1, duration: 0.45, ease: OUT }, 0.18)
      .fromTo(q('.c1'), { rotationY: -180, y: -70, opacity: 0 }, { rotationY: 0, y: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.4)' }, 0.3)
      .fromTo(q('.c1'), { '--sh': '-80%' }, { '--sh': '80%', duration: 0.7, ease: 'power2.inOut' }, 0.75)
      .fromTo(q('.body .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.06 }, 0.36)
      .fromTo(q('.name'), { letterSpacing: '0.16em' }, { letterSpacing: '0.01em', duration: 0.9, ease: OUT }, 0.36)
      .call(() => decode(q('.num')[0]), [], 0.42)
      .fromTo(q('.meta'), { '--r': 0 }, { '--r': 1, duration: 0.4, ease: OUT }, 0.62)
      .fromTo(q('.meta .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.4, ease: OUT }, 0.72);

    if (second) {
      tl.fromTo(q('.c2'), { x: 70, y: -50, rotation: 24, opacity: 0 }, { x: 12, y: -6, rotation: 9, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' }, 1.1)
        .to(q('.c2'), { x: 0, y: 0, rotation: 0, duration: 0.3, ease: 'power3.in' }, 2.2)
        .to(q('.card'), { rotationY: 90, duration: 0.2, ease: 'power2.in' }, 2.5)
        .set(root, { '--card': ALERT }, 2.7)
        .to(q('.card'), { rotationY: 0, duration: 0.45, ease: 'back.out(2)' }, 2.7)
        .fromTo(q('.card'), { '--sh': '-80%' }, { '--sh': '80%', duration: 0.6, ease: 'power2.inOut', immediateRender: false }, 2.85)
        .to(q('.labels'), { yPercent: -50, duration: 0.45, ease: 'expo.inOut' }, 2.62)
        .fromTo(q('.flash'), { scaleX: 0, opacity: 0.9, transformOrigin: '0 50%' }, { scaleX: 1, opacity: 0, duration: 0.7, ease: 'power2.out', immediateRender: false }, 2.7);
    }

    tl.addLabel('out', second ? 6 : 4)
      .to(q('.rise'), { yPercent: -115, duration: 0.28, ease: 'power3.in', stagger: 0.02 }, 'out')
      .to(q('.card'), { rotationY: 90, opacity: 0, duration: 0.25, ease: 'power2.in' }, 'out')
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

<div class="regie mo l3" bind:this={root} style:--card={color === 'red' ? ALERT : '#ffd21f'} style:--c={team.color} style:--fs="{tall ? fit(name, 54, 860) : 54}px">
  <div class="rule"></div>
  <div class="body sheet">
    <div class="flash"></div>
    <div class="tab">
      <div class="card c1"></div>
      {#if color === 'second_yellow'}<div class="card c2"></div>{/if}
    </div>
    <div class="txt">
      <div class="kicker up"><div class="labels rise">{#each labels[color] as label (label)}<span>{label}</span>{/each}</div></div>
      <div class="who">
        {#if player}<span class="up"><span class="rise mono num">{player.number}</span></span>{/if}
        <span class="up"><span class="rise name">{name}</span></span>
      </div>
    </div>
  </div>
  <div class="meta sheet"><i></i><span class="up"><span class="rise">{team.name}<b class="mono">{minute}</b></span></span></div>
</div>

<style>
  .l3 {
    min-width: 520px;
    width: max-content;
  }
  .body {
    position: relative;
    display: flex;
    height: 106px;
  }
  .flash {
    position: absolute;
    inset: 0;
    background: var(--alert);
    opacity: 0;
  }
  .tab {
    position: relative;
    width: 96px;
    flex: none;
    background: var(--bg2);
    perspective: 500px;
  }
  .card {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 44px;
    height: 62px;
    margin: -31px 0 0 -22px;
    border-radius: 5px;
    background: var(--card);
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }
  /* Reflet qui balaie le carton. */
  .card::after {
    content: '';
    position: absolute;
    inset: -20% -60%;
    background: linear-gradient(105deg, transparent 42%, rgba(255, 255, 255, 0.6) 50%, transparent 58%);
    transform: translateX(var(--sh, -80%));
  }
  .txt {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 9px;
    padding: 0 44px 0 26px;
  }
  .kicker {
    height: 18px;
    padding: 0;
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.16em;
    --wd: 100;
    color: var(--card);
  }
  .labels span {
    display: block;
    height: 18px;
    line-height: 18px;
  }
  .who {
    display: flex;
    align-items: baseline;
    gap: 18px;
  }
  .num {
    font-size: calc(var(--fs) * 0.82);
    color: var(--card);
  }
  .name {
    font-size: var(--fs);
    font-weight: 800;
  }
  .meta {
    width: max-content;
    height: 38px;
    margin-left: 96px;
    padding: 0 26px 0 0;
    display: flex;
    align-items: center;
    gap: 20px;
    background: var(--bg2);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.14em;
    --wd: 100;
    color: var(--mut);
  }
  .meta i {
    align-self: stretch;
    width: 5px;
    background: var(--c);
  }
  .meta b {
    margin-left: 14px;
    color: var(--tx);
  }
  :global(.tall) .l3 {
    min-width: 0;
  }
</style>
