<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import type { PlayerRef, TeamConfig } from '../../shared/types';
  import { inkOn, letters, OUT } from './motion';
  import './tigre.css';

  // Le sortant arrive d'abord, puis l'entrant prend la grande ligne pendant que le sortant est barré.
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

  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;

  onMount(() => {
    const q = gsap.utils.selector(root);
    const inChars = q('.in .ch > span');
    const outChars = q('.out .ch > span');
    tl = gsap
      .timeline({ onComplete: () => ondone?.() })
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.head'), { '--p': 0 }, { '--p': 1, duration: 0.45, ease: OUT }, 0)
      .fromTo(q('.head > *'), { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, stagger: 0.07 }, 0.12)
      .fromTo(q('.out'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT }, 0.2)
      .fromTo(q('.out > *'), { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.05 }, 0.3)
      .fromTo(outChars, { yPercent: 115 }, { yPercent: 0, duration: 0.45, ease: OUT, stagger: 0.02 }, 0.32)
      .fromTo(q('.in'), { '--p': 0 }, { '--p': 1, duration: 0.65, ease: OUT }, 0.75)
      .fromTo(q('.in .arrow'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(2.5)' }, 0.9)
      .fromTo(q('.in .num'), { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: OUT }, 0.92)
      .fromTo(inChars, { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: OUT, stagger: 0.026 }, 0.95)
      .fromTo(q('.in .name'), { '--wd': 55 }, { '--wd': (playerIn?.name.length ?? 0) > 16 ? 78 : 100, duration: 1, ease: OUT }, 0.95)
      .fromTo(q('.strike'), { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power3.inOut' }, 1.25)
      .to(q('.out .name, .out .num'), { opacity: 0.4, duration: 0.4 }, 1.3)
      .to(q('.out .arrow'), { y: 6, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 5 }, 1.2)
      .to(q('.in .arrow'), { y: -7, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 5 }, 1.4)
      .addLabel('out', 4.6)
      .to([...inChars, ...outChars], { yPercent: -115, duration: 0.28, ease: 'power3.in', stagger: 0.008 }, 'out')
      .to(q('.row > *, .head > *'), { opacity: 0, duration: 0.2 }, 'out+=0.1')
      .to(q('.out, .in, .head'), { '--q': 1, duration: 0.5, ease: 'expo.inOut', stagger: 0.06 }, 'out+=0.15')
      .set(root, { autoAlpha: 0 }, 'out+=0.9');
    return () => tl?.kill();
  });

  $effect(() => {
    if (hurry && tl && tl.time() < tl.labels.out) tl.play('out');
  });
</script>

<div class="tigre mo sub-mo" bind:this={root} style:--team={team.color} style:--ink={inkOn(team.color)}>
  <div class="head para"><span>Remplacement · {team.name}</span><span class="min">{minute}</span></div>
  {#if playerIn}
    <div class="row in para">
      <i class="arrow up"></i><span class="num">{playerIn.number}</span>
      <span class="name">{#each letters(playerIn.name) as c, i (i)}<span class="ch"><span>{c}</span></span>{/each}</span>
    </div>
  {/if}
  {#if playerOut}
    <div class="row out para hatch" class:alone={!playerIn}>
      <i class="arrow down"></i><span class="num">{playerOut.number}</span>
      <span class="name">
        {#each letters(playerOut.name) as c, i (i)}<span class="ch"><span>{c}</span></span>{/each}<i class="strike"></i>
      </span>
    </div>
  {/if}
</div>

<style>
  .sub-mo {
    left: 118px;
  }
  .head {
    height: 40px;
    --s: 10px;
    background: var(--team);
    color: var(--ink);
    width: max-content;
    padding: 0 30px 0 28px;
    display: flex;
    gap: 14px;
    align-items: center;
    font-size: 19px;
    font-weight: 800;
    letter-spacing: 0.13em;
    --wd: 88;
  }
  .min {
    opacity: 0.7;
  }
  .row {
    width: max-content;
    display: flex;
    align-items: center;
    white-space: nowrap;
  }
  /* Chaque ligne est décalée vers la gauche pour suivre l'inclinaison de celle du dessus. */
  .in {
    height: 96px;
    --s: 24px;
    background: var(--w);
    color: var(--k);
    margin: 5px 0 0 -25px;
    padding: 0 64px 0 50px;
    gap: 22px;
    font-size: 60px;
  }
  .out {
    height: 58px;
    --s: 14.5px;
    background-color: var(--k);
    margin: 5px 0 0 -41px;
    padding: 0 44px 0 40px;
    gap: 16px;
    font-size: 30px;
    font-weight: 800;
    --wd: 84;
  }
  .out.alone {
    margin-left: -16px;
  }
  .num {
    font-variation-settings: 'wdth' 70;
  }
  .in .num {
    color: var(--o);
  }
  .out .name {
    position: relative;
  }
  .strike {
    position: absolute;
    left: -6px;
    right: -6px;
    top: 50%;
    height: 4px;
    margin-top: -2px;
    background: #f0323c;
    transform-origin: 0 50%;
  }
  .arrow {
    width: 0;
    height: 0;
    border-left: 13px solid transparent;
    border-right: 13px solid transparent;
  }
  .arrow.up {
    border-bottom: 20px solid #12a65c;
  }
  .arrow.down {
    border-top: 15px solid #f0323c;
    border-left-width: 10px;
    border-right-width: 10px;
  }
</style>
