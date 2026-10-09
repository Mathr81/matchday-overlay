<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { PlayerRef, TeamConfig } from '../../shared/types';
  import { fit, inkOn, OUT, POP, softFrom, softTo, SPRING } from './motion';
  import './clair.css';

  // Remplacement : la pastille du sortant arrive d'abord, puis celle de l'entrant se gonfle au-dessus et la pousse.
  let {
    playerIn,
    playerOut,
    team,
    minute,
    hurry = false,
    ondone,
  }: {
    playerIn: PlayerRef | null;
    playerOut: PlayerRef | null;
    team: TeamConfig;
    minute: string;
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
      .fromTo(q('.tag'), { scale: 0, rotation: -22 }, { scale: 1, rotation: -3, duration: 0.55, ease: 'back.out(2.4)' }, 0)
      .fromTo(q('.out'), { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: POP }, 0.1)
      .fromTo(q('.out .tx'), softFrom, { ...softTo, stagger: 0.06 }, 0.25)
      .fromTo(q('.in'), { '--o': 0 }, { '--o': 1, duration: 0.65, ease: OUT }, 0.7)
      .fromTo(q('.in'), { scale: 0.5 }, { scale: 1, duration: 0.65, ease: 'back.out(1.5)' }, 0.7)
      .fromTo(q('.out'), { y: -40 }, { y: 0, duration: 0.8, ease: SPRING, immediateRender: false }, 0.7)
      .fromTo(q('.in .badge'), { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.9, ease: SPRING }, 0.85)
      .fromTo(q('.in .tx'), softFrom, { ...softTo, stagger: 0.08 }, 0.95)
      .to(q('.out'), { opacity: 0.82, duration: 0.4 }, 1.3)
      .to(q('.in .badge'), { y: -5, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 5 }, 1.8)
      .addLabel('out', 4.6)
      .to(q('.tag'), { scale: 0, rotation: 14, duration: 0.25, ease: 'back.in(2)' }, 'out')
      .to(q('.tx'), { opacity: 0, duration: 0.2 }, 'out')
      .to(q('.out'), { scale: 0.5, opacity: 0, duration: 0.3, ease: 'back.in(2)' }, 'out')
      .to(q('.in .badge'), { scale: 0, duration: 0.3, ease: 'back.in(1.8)' }, 'out+=0.05')
      .to(q('.in'), { '--o': 0, scale: 0.6, duration: 0.35, ease: 'expo.in' }, 'out+=0.18')
      .set(root, { autoAlpha: 0 }, 'out+=0.6');
    return () => tl?.kill();
  });

  $effect(() => {
    if (hurry && tl && tl.time() < tl.labels.out) tl.play('out');
  });
</script>

<div class="clair mo" bind:this={root} style:--c={team.color} style:--tink={inkOn(team.color)} style:--fs="{fit(playerIn?.name ?? '', 50, tall ? 860 : 1500)}px">
  <div class="stack">
    <div class="tag"><b>Remplacement</b><span>{team.name} · {minute}</span></div>
    {#if playerIn}
      <div class="in pill">
        <span class="badge up"><i></i></span>
        <span class="num tx">{playerIn.number}</span>
        <span class="name tx">{playerIn.name}</span>
      </div>
    {/if}
    {#if playerOut}
      <div class="out">
        <span class="badge down"><i></i></span>
        <span class="num tx">{playerOut.number}</span>
        <span class="name tx">{playerOut.name}</span>
      </div>
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
    background: var(--c);
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
  .in,
  .out {
    display: flex;
    align-items: center;
    white-space: nowrap;
  }
  .in {
    gap: 20px;
    height: 98px;
    padding: 0 48px 0 11px;
    font-size: var(--fs);
    font-weight: 800;
  }
  .out {
    gap: 14px;
    height: 54px;
    padding: 0 28px 0 8px;
    margin: 6px 0 0 44px;
    border-radius: 999px;
    background: var(--fog);
    font-size: 26px;
    color: var(--soft);
  }
  .num {
    font-size: 0.9em;
    color: var(--soft);
  }
  .badge {
    display: grid;
    place-items: center;
    flex: none;
    border-radius: 50%;
  }
  .badge i {
    width: 0;
    height: 0;
    border-left: 0.5em solid transparent;
    border-right: 0.5em solid transparent;
  }
  .badge.up {
    width: 76px;
    height: 76px;
    background: var(--ok);
    font-size: 30px;
  }
  .badge.up i {
    border-bottom: 0.8em solid #fff;
    margin-top: -0.12em;
  }
  .badge.down {
    width: 38px;
    height: 38px;
    background: var(--alert);
    font-size: 15px;
  }
  .badge.down i {
    border-top: 0.8em solid #fff;
    margin-top: 0.14em;
  }
</style>
