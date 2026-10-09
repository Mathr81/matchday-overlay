<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import { formatClock, periodLabel } from '../../shared/clock';
  import type { Config, MatchState, TeamId } from '../../shared/types';
  import Roll from '../Roll.svelte';
  import { OUT, POP, SPRING, softFrom, softTo } from './motion';
  import './clair.css';

  // Pastille blanche centrée en haut : disque, sigle, score dans une capsule sombre, sigle, disque.
  // Le chrono est dans une petite pastille accrochée dessous.
  let { config, match, visible, offset }: { config: Config; match: MatchState; visible: boolean; offset: number } = $props();

  const teams: TeamId[] = ['home', 'away'];
  let root: HTMLDivElement;
  let addTag: HTMLDivElement;
  let penTag: HTMLDivElement;
  let timeline: gsap.core.Timeline | null = null;
  let shown = false;
  let last: Record<TeamId, number> | null = null;
  let clockText = $state('00:00');
  // Garde la dernière valeur pendant que la bulle se dégonfle.
  let addedText = $state(0);

  const read = () => {
    clockText = formatClock(match.clock, config.format, Date.now() + offset);
  };

  onMount(() => {
    const id = setInterval(read, 200);
    return () => {
      clearInterval(id);
      timeline?.kill();
    };
  });

  $effect(read);

  function enter() {
    const q = gsap.utils.selector(root);
    return gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.bar'), { '--o': 0 }, { '--o': 1, duration: 0.7, ease: OUT }, 0)
      .fromTo(q('.bar'), { scale: 0.5 }, { scale: 1, duration: 0.7, ease: 'back.out(1.5)' }, 0)
      .fromTo(q('.bar .disc'), { scale: 0 }, { scale: 1, duration: 0.9, ease: SPRING, stagger: 0.12 }, 0.22)
      .fromTo(q('.score'), { scale: 0 }, { scale: 1, duration: 0.5, ease: POP }, 0.3)
      .fromTo(q('.code'), softFrom, { ...softTo, stagger: 0.08 }, 0.36)
      .fromTo(q('.clock'), { scale: 0.4, y: -22, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: POP }, 0.5);
  }

  function exit() {
    const q = gsap.utils.selector(root);
    return gsap
      .timeline()
      .to(q('.clock'), { scale: 0.4, y: -22, opacity: 0, duration: 0.25, ease: 'back.in(2)' }, 0)
      .to(q('.code'), { opacity: 0, duration: 0.2 }, 0)
      .to(q('.bar .disc, .score'), { scale: 0, duration: 0.3, ease: 'back.in(1.8)', stagger: 0.04 }, 0.05)
      .to(q('.bar'), { '--o': 0, scale: 0.6, duration: 0.35, ease: 'expo.in' }, 0.2)
      .set(root, { autoAlpha: 0 });
  }

  $effect(() => {
    const want = visible;
    if (!root || want === shown) return;
    shown = want;
    timeline?.kill();
    timeline = want ? enter() : exit();
  });

  // Temps additionnel et score des tirs au but : une bulle se gonfle à côté du chrono.
  const bubble = (el: HTMLElement | undefined, open: boolean) =>
    el && gsap.to(el, { scale: open ? 1 : 0, duration: open ? 0.5 : 0.25, ease: open ? POP : 'back.in(2)', delay: open ? 0.3 : 0 });
  $effect(() => {
    const minutes = match.clock.addedMinutes;
    const open = visible && minutes !== null && minutes > 0;
    if (open) addedText = minutes;
    bubble(addTag, open);
  });
  const pens = $derived(match.shootout?.score ?? null);
  $effect(() => {
    bubble(penTag, visible && pens !== null);
  });

  // But : la capsule du score rebondit, une onde part du disque de l'équipe.
  $effect(() => {
    const score = { ...match.score };
    if (last && root && shown) {
      for (const team of teams) {
        if (score[team] === last[team]) continue;
        const q = gsap.utils.selector(root);
        gsap
          .timeline()
          .fromTo(q('.score'), { scale: 1 }, { scale: 1.22, duration: 0.16, ease: 'power2.out' }, 0.2)
          .to(q('.score'), { scale: 1, duration: 0.9, ease: SPRING }, 0.36)
          .fromTo(q(`.${team} .ring`), { scale: 1, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 0.9, ease: 'power2.out' }, 0.2)
          .fromTo(q(`.${team} .disc`), { y: 0 }, { y: -10, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.2);
      }
    }
    last = score;
  });
</script>

<div class="clair bug" bind:this={root}>
  <div class="bar pill">
    {#each teams as team (team)}
      {@const t = config.teams[team]}
      <div class="team {team}" style:--c={t.color}>
        <span class="disc" class:light={t.logoOnLight}><i class="ring"></i><img src={t.logo} alt="" /></span>
        <span class="code">{t.code}</span>
      </div>
      {#if team === 'home'}
        <div class="score cap"><Roll value={match.score.home} ease="back.inOut(1.6)" /><i>–</i><Roll value={match.score.away} ease="back.inOut(1.6)" /></div>
      {/if}
    {/each}
  </div>
  <div class="under">
    <div class="clock">
      <b>{clockText}</b><span>{periodLabel(match.clock, config.format)}</span>
      <div class="bubbles">
        <div class="bubble sun" bind:this={addTag}>+{addedText}</div>
        <div class="bubble dark" bind:this={penTag}>t.a.b. {pens?.home ?? 0}–{pens?.away ?? 0}</div>
      </div>
    </div>
  </div>
</div>

<style>
  .bug {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(44px / 1.2);
    zoom: 1.2;
    display: flex;
    flex-direction: column;
    align-items: center;
    visibility: hidden;
    filter: drop-shadow(0 10px 18px rgba(16, 24, 40, 0.28));
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 70px;
    padding: 0 9px;
  }
  .team {
    display: flex;
    align-items: center;
    gap: 13px;
  }
  .team.away {
    flex-direction: row-reverse;
  }
  .disc {
    width: 52px;
    height: 52px;
  }
  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 4px solid var(--c);
    opacity: 0;
  }
  .code {
    font-size: 29px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }
  .score {
    gap: 9px;
    height: 54px;
    padding: 0 22px;
    font-size: 38px;
    font-weight: 800;
  }
  .score i {
    font-style: normal;
    opacity: 0.45;
  }
  .under {
    margin-top: -7px;
  }
  .clock {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 18px;
    border-radius: 999px;
    background: var(--paper);
    white-space: nowrap;
  }
  .clock b {
    font-size: 21px;
    font-weight: 800;
  }
  .clock span {
    font-size: 15px;
    font-weight: 600;
    color: var(--soft);
  }
  .bubbles {
    position: absolute;
    left: 100%;
    top: 3px;
    margin-left: 6px;
    display: grid;
  }
  .bubble {
    grid-area: 1 / 1;
    height: 30px;
    padding: 0 13px;
    display: flex;
    align-items: center;
    border-radius: 999px;
    font-size: 17px;
    font-weight: 800;
    transform: scale(0);
    transform-origin: 0 50%;
  }
  .sun {
    background: var(--sun);
  }
  .dark {
    background: var(--ink);
    color: #fff;
  }
  :global(.tall) .bug {
    top: calc(var(--safe-top) / 1.4);
    zoom: 1.4;
  }
</style>
