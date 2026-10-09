<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { PlayerRef, TeamConfig } from '../../shared/types';
  import { ALERT, fit, OUT, POP, softFrom, softTo, SPRING } from './motion';
  import './clair.css';

  // Le carton tombe sur le bord de la pastille et se balance. Deuxième jaune : un second carton se pose à côté,
  // ils se rejoignent et se retournent en rouge, l'étiquette passe à « Expulsion ».
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
      .fromTo(q('.main'), { '--o': 0 }, { '--o': 1, duration: 0.65, ease: OUT }, 0)
      .fromTo(q('.main'), { scale: 0.5 }, { scale: 1, duration: 0.65, ease: 'back.out(1.5)' }, 0)
      .fromTo(q('.c1'), { y: -260, rotation: -70, opacity: 0 }, { y: 0, rotation: -8, opacity: 1, duration: 1, ease: 'elastic.out(1, 0.6)' }, 0.15)
      .fromTo(q('.tx'), softFrom, { ...softTo, stagger: 0.08 }, 0.28)
      .fromTo(q('.tag'), { scale: 0, rotation: -22 }, { scale: 1, rotation: -3, duration: 0.55, ease: 'back.out(2.4)' }, 0.34)
      .fromTo(q('.meta'), { scale: 0.6, y: -22, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: POP }, 0.55);

    if (second) {
      tl.fromTo(q('.c2'), { y: -260, x: 60, rotation: 70, opacity: 0 }, { y: -4, x: 24, rotation: 12, opacity: 1, duration: 0.9, ease: 'elastic.out(1, 0.6)' }, 1.1)
        .to(q('.c2'), { x: 0, y: 0, rotation: -8, duration: 0.3, ease: 'power3.in' }, 2.2)
        .to(q('.card'), { scaleX: 0, duration: 0.18, ease: 'power2.in' }, 2.5)
        .set(root, { '--card': ALERT, '--cardink': '#fff' }, 2.68)
        .to(q('.card'), { scaleX: 1, duration: 0.7, ease: SPRING }, 2.68)
        .to(q('.labels'), { yPercent: -50, duration: 0.5, ease: 'back.inOut(1.6)' }, 2.6)
        .fromTo(q('.main'), { scale: 1 }, { scale: 1.06, duration: 0.14, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false }, 2.68);
    }

    tl.addLabel('out', second ? 6 : 4)
      .to(q('.meta'), { scale: 0.6, y: -22, opacity: 0, duration: 0.25, ease: 'back.in(2)' }, 'out')
      .to(q('.tag'), { scale: 0, rotation: 14, duration: 0.25, ease: 'back.in(2)' }, 'out')
      .to(q('.tx'), { opacity: 0, duration: 0.2 }, 'out')
      .to(q('.card'), { y: 160, rotation: 30, opacity: 0, duration: 0.35, ease: 'power3.in', stagger: 0.04 }, 'out')
      .to(q('.main'), { '--o': 0, scale: 0.6, duration: 0.35, ease: 'expo.in' }, 'out+=0.18')
      .set(root, { autoAlpha: 0 }, 'out+=0.6');
    return () => tl?.kill();
  });

  $effect(() => {
    if (hurry && tl && tl.time() < tl.labels.out) tl.play('out');
  });
</script>

<div class="clair mo" bind:this={root} style:--card={color === 'red' ? ALERT : '#ffc400'} style:--cardink={color === 'red' ? '#fff' : '#14161a'} style:--c={team.color} style:--fs="{fit(name, 54, tall ? 860 : 1500)}px">
  <div class="stack">
    <div class="tag"><div class="labels">{#each labels[color] as label (label)}<span>{label}</span>{/each}</div></div>
    <div class="row">
      <div class="cards">
        <div class="card c1"></div>
        {#if color === 'second_yellow'}<div class="card c2"></div>{/if}
      </div>
      <div class="main pill">
        {#if player}<span class="num tx">{player.number}</span>{/if}
        <span class="name tx">{name}</span>
      </div>
    </div>
    <div class="meta cap"><i></i><b>{team.name}</b><span>{minute}</span></div>
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
    z-index: 2;
    height: 40px;
    padding: 0 20px;
    margin: 0 0 -12px 104px;
    border-radius: 999px;
    background: var(--card);
    color: var(--cardink);
    font-size: 21px;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
  }
  .labels span {
    display: block;
    height: 40px;
    line-height: 40px;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
  }
  .cards {
    position: relative;
    z-index: 1;
    width: 70px;
    height: 96px;
    margin-right: -26px;
  }
  .card {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    background: var(--card);
    box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.35);
  }
  .main {
    display: flex;
    align-items: center;
    gap: 22px;
    height: 104px;
    padding: 0 50px 0 56px;
    white-space: nowrap;
  }
  .num {
    font-size: calc(var(--fs) * 0.9);
    font-weight: 800;
    color: var(--soft);
  }
  .name {
    font-size: var(--fs);
    font-weight: 800;
  }
  .meta {
    gap: 10px;
    height: 38px;
    padding: 0 22px 0 14px;
    margin: -9px 0 0 120px;
    font-size: 17px;
  }
  .meta i {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 0 2px #fff;
  }
  .meta span {
    font-weight: 600;
    opacity: 0.7;
  }
</style>
