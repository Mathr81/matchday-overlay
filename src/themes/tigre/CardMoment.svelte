<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { PlayerRef, TeamConfig } from '../../shared/types';
  import { ALERT, fit, letters, OUT } from './motion';
  import './tigre.css';

  // Le carton tombe en tournant. Deuxième jaune : il se pose sur le premier, puis les deux se retournent en rouge.
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
    const chars = q('.name .ch > span');
    const second = color === 'second_yellow';
    tl = gsap
      .timeline({ onComplete: () => ondone?.() })
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.c1'), { y: -520, x: 120, rotationY: -540, rotation: -50, opacity: 0 }, { y: 0, x: 0, rotationY: 0, rotation: -9, opacity: 1, duration: 0.8, ease: 'back.out(1.25)' }, 0)
      .fromTo(q('.c1'), { '--sh': '-70%' }, { '--sh': '70%', duration: 0.7, ease: 'power2.inOut' }, 0.65)
      .fromTo(q('.slab'), { '--p': 0 }, { '--p': 1, duration: 0.6, ease: OUT }, 0.3)
      .fromTo(q('.kicker'), { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: OUT }, 0.45)
      .fromTo(q('.num'), { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: OUT }, 0.5)
      .fromTo(chars, { yPercent: 115 }, { yPercent: 0, duration: 0.5, ease: OUT, stagger: 0.024 }, 0.52)
      .fromTo(q('.who'), { '--wd': 55 }, { '--wd': name.length > 16 ? 76 : 96, duration: 0.9, ease: OUT }, 0.52)
      .fromTo(q('.team'), { '--p': 0 }, { '--p': 1, duration: 0.45, ease: OUT }, 0.7)
      .fromTo(q('.team > *'), { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, stagger: 0.07 }, 0.82);

    if (second) {
      tl.fromTo(q('.c2'), { y: -520, x: 200, rotationY: 540, rotation: 60, opacity: 0 }, { y: -8, x: 34, rotationY: 0, rotation: 7, opacity: 1, duration: 0.7, ease: 'back.out(1.3)' }, 1)
        .to(q('.c2'), { x: 0, y: 0, rotation: -9, duration: 0.3, ease: 'power3.in' }, 2.2)
        .to(q('.card'), { rotationY: 90, scale: 1.25, duration: 0.22, ease: 'power2.in' }, 2.5)
        .set(q('.card'), { backgroundColor: ALERT }, 2.72)
        .to(q('.card'), { rotationY: 0, scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, 2.72)
        .fromTo(q('.card'), { '--sh': '-70%' }, { '--sh': '70%', duration: 0.6, ease: 'power2.inOut', immediateRender: false }, 2.9)
        .to(q('.labels'), { y: -22, duration: 0.4, ease: 'expo.inOut' }, 2.65)
        .to(q('.kicker, .num'), { color: '#FF6A72', duration: 0.3 }, 2.72)
        .fromTo(q('.flash'), { opacity: 0.95 }, { opacity: 0, duration: 0.8, ease: 'power2.out', immediateRender: false }, 2.72)
        .fromTo(root, { x: -14 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2,.25)', immediateRender: false }, 2.72);
    }

    tl.addLabel('out', second ? 6 : 4)
      .to(q('.card'), { y: 260, rotation: 30, opacity: 0, duration: 0.45, ease: 'power3.in', stagger: 0.04 }, 'out')
      .to(chars, { yPercent: -115, duration: 0.28, ease: 'power3.in', stagger: 0.01 }, 'out')
      .to(q('.kicker, .num, .team > *'), { opacity: 0, duration: 0.2 }, 'out+=0.08')
      .to(q('.team, .slab'), { '--q': 1, duration: 0.5, ease: 'expo.inOut', stagger: 0.06 }, 'out+=0.14')
      .set(root, { autoAlpha: 0 }, 'out+=0.8');
    return () => tl?.kill();
  });

  $effect(() => {
    if (hurry && tl && tl.time() < tl.labels.out) tl.play('out');
  });
</script>

<div class="tigre mo card-mo" class:red={color === 'red'} bind:this={root} style:--team={team.color} style:--fs="{tall ? fit(name, 58, 1000) : 58}px">
  <div class="stack">
    <div class="card c1"></div>
    {#if color === 'second_yellow'}<div class="card c2"></div>{/if}
  </div>
  <div>
    <div class="slab para hatch">
      <div class="flash"></div>
      <div class="kicker">
        <div class="labels">{#each labels[color] as label (label)}<span>{label}</span>{/each}</div>
      </div>
      <div class="who">
        {#if player}<span class="num">{player.number}</span>{/if}
        <span class="name">{#each letters(name) as c, i (i)}<span class="ch"><span>{c}</span></span>{/each}</span>
      </div>
    </div>
    <div class="team para"><span>{team.name}</span><span class="min">{minute}</span></div>
  </div>
</div>

<style>
  .card-mo {
    left: 104px;
    display: flex;
    align-items: flex-end;
    gap: 34px;
    --card: #ffd21f;
  }
  .card-mo.red {
    --card: #f0323c;
  }
  .stack {
    position: relative;
    width: 92px;
    height: 128px;
    perspective: 700px;
    margin-bottom: 10px;
  }
  .card {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    background: var(--card);
    box-shadow:
      0 14px 30px rgba(0, 0, 0, 0.45),
      inset 0 0 0 3px rgba(255, 255, 255, 0.28);
    overflow: hidden;
  }
  /* Reflet qui balaie le carton. */
  .card::after {
    content: '';
    position: absolute;
    inset: -20% -60%;
    background: linear-gradient(105deg, transparent 42%, rgba(255, 255, 255, 0.55) 50%, transparent 58%);
    transform: translateX(var(--sh, -70%));
  }
  .slab {
    position: relative;
    height: 112px;
    --s: 28px;
    background-color: var(--k);
    padding: 0 70px 0 56px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
  }
  .flash {
    position: absolute;
    inset: 0;
    background: #f0323c;
    opacity: 0;
  }
  .kicker {
    position: relative;
    height: 22px;
    overflow: hidden;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.14em;
    --wd: 88;
    color: var(--card);
  }
  .labels span {
    display: block;
    height: 22px;
    line-height: 22px;
    white-space: nowrap;
  }
  .who {
    position: relative;
    font-size: var(--fs);
    white-space: nowrap;
    display: flex;
    gap: 18px;
  }
  .num {
    color: var(--card);
    font-variation-settings: 'wdth' 70;
  }
  .team {
    height: 44px;
    --s: 11px;
    background: var(--team);
    margin: 6px 0 0 -13px;
    padding: 0 34px 0 30px;
    display: inline-flex;
    gap: 14px;
    align-items: center;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.1em;
    --wd: 85;
    color: #fff;
  }
  .min {
    opacity: 0.7;
  }
  :global(.tall) .card-mo {
    left: 70px;
    gap: 28px;
  }
</style>
