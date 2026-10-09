<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import { elapsedInPeriod, formatClock, periodLabel } from '../../shared/clock';
  import { periodLength } from '../../shared/format';
  import type { Config, MatchState, TeamId } from '../../shared/types';
  import Roll from '../Roll.svelte';
  import { OUT } from './motion';
  import './regie.css';

  // Barre compacte : équipe, score, équipe, chrono. Un trait fin en bas avance avec la période.
  let { config, match, visible, offset }: { config: Config; match: MatchState; visible: boolean; offset: number } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const teams: TeamId[] = ['home', 'away'];
  let root: HTMLDivElement;
  let addTag: HTMLDivElement;
  let penTag: HTMLDivElement;
  let timeline: gsap.core.Timeline | null = null;
  let shown = false;
  let last: Record<TeamId, number> | null = null;
  let clockText = $state('00:00');
  let progress = $state(0);
  // Garde la dernière valeur pendant que l'étiquette se referme.
  let addedText = $state(0);

  const label = $derived(periodLabel(match.clock, config.format));
  const live = $derived(match.clock.phase === 'running');
  const read = () => {
    const now = Date.now() + offset;
    clockText = formatClock(match.clock, config.format, now);
    progress = match.clock.period === 0 ? 0 : Math.min(1, elapsedInPeriod(match.clock, now) / periodLength(config.format, match.clock.period));
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
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: OUT, transformOrigin: '0 50%' }, 0)
      .fromTo(q('.bar'), { '--r': 0 }, { '--r': 1, duration: 0.45, ease: OUT }, 0.2)
      .fromTo(q('.stripe'), { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: OUT, stagger: 0.1 }, 0.3)
      .fromTo(q('.bar .chip'), { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(1.8)', stagger: 0.1 }, 0.36)
      .fromTo(q('.bar .rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.5, ease: OUT, stagger: 0.045 }, 0.32)
      .fromTo(q('.prog'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.6)
      .fromTo(q('.t-per'), { '--r': 0 }, { '--r': 1, duration: 0.35, ease: OUT }, 0.6);
  }

  function exit() {
    const q = gsap.utils.selector(root);
    return gsap
      .timeline()
      .to(q('.t-per'), { '--r': 0, duration: 0.25, ease: 'power3.in' }, 0)
      .to(q('.bar .rise'), { yPercent: -115, duration: 0.25, ease: 'power3.in', stagger: 0.02 }, 0)
      .to(q('.bar .chip'), { scale: 0, duration: 0.2, ease: 'power2.in' }, 0)
      .to(q('.prog'), { opacity: 0, duration: 0.2 }, 0)
      .to(q('.bar'), { '--r': 0, duration: 0.35, ease: 'expo.inOut' }, 0.15)
      .to(q('.rule'), { scaleX: 0, duration: 0.3, ease: 'expo.in', transformOrigin: '100% 50%' }, 0.35)
      .set(root, { autoAlpha: 0 });
  }

  $effect(() => {
    const want = visible;
    if (!root || want === shown) return;
    shown = want;
    timeline?.kill();
    timeline = want ? enter() : exit();
  });

  // Temps additionnel et score des tirs au but : une étiquette sort du bout de la barre.
  $effect(() => {
    const minutes = match.clock.addedMinutes;
    const open = visible && minutes !== null && minutes > 0;
    if (open) addedText = minutes;
    if (addTag) gsap.to(addTag, { '--r': open ? 1 : 0, duration: 0.45, ease: open ? OUT : 'power3.in', delay: open ? 0.3 : 0 });
  });
  const pens = $derived(match.shootout?.score ?? null);
  $effect(() => {
    const open = visible && pens !== null;
    if (penTag) gsap.to(penTag, { '--r': open ? 1 : 0, duration: 0.45, ease: open ? OUT : 'power3.in', delay: open ? 0.3 : 0 });
  });

  // But : la couleur de l'équipe traverse sa case, le temps que le chiffre roule.
  $effect(() => {
    const score = { ...match.score };
    if (last && root && shown) {
      for (const team of teams) {
        if (score[team] === last[team]) continue;
        const flood = root.querySelector(`.${team} .flood`);
        gsap
          .timeline()
          .fromTo(flood, { scaleX: 0, transformOrigin: team === 'home' ? '0 50%' : '100% 50%' }, { scaleX: 1, duration: 0.4, ease: OUT }, 0.15)
          .to(flood, { scaleX: 0, transformOrigin: team === 'home' ? '100% 50%' : '0 50%', duration: 0.5, ease: 'expo.inOut' }, 1.3)
          .fromTo(root.querySelector(`.d-${team}`), { backgroundColor: '#f3f4f6', color: '#0d0f13' }, { backgroundColor: '#1b2028', color: '#f3f4f6', duration: 0.9, ease: 'power2.out' }, 0.45);
      }
    }
    last = score;
  });
</script>

<div class="regie bug" bind:this={root}>
  <div class="rule"></div>
  <div class="bar sheet">
    {#each teams as team (team)}
      {@const t = config.teams[team]}
      <div class="team {team}" style:--c={t.color}>
        <i class="flood"></i><i class="stripe"></i>
        <span class="chip" class:light={t.logoOnLight}><img src={t.logo} alt="" /></span>
        <span class="up"><span class="rise code">{t.code}</span></span>
      </div>
      {#if team === 'home'}
        <div class="score mono">
          <span class="digit d-home"><span class="rise"><Roll value={match.score.home} /></span></span>
          <span class="digit d-away"><span class="rise"><Roll value={match.score.away} /></span></span>
        </div>
      {/if}
    {/each}
    <div class="time">
      {#if !tall}<span class="up"><span class="rise lab per"><i class="dot" class:live></i>{label}</span></span>{/if}
      <span class="up"><span class="rise mono clock">{clockText}</span></span>
    </div>
    <div class="prog" class:over={progress >= 1 && live}><i style:transform="scaleX({progress})"></i></div>
  </div>
  <div class="tags">
    <div class="tw">
    {#if tall}<div class="tag sheet t-per lab"><i class="dot" class:live></i>{label}</div>{/if}
    <div class="extra">
      <div class="tag sheet side t-add mono" bind:this={addTag}>+{addedText}</div>
      <div class="tag sheet side t-add" bind:this={penTag}><small>T.A.B.</small><span class="mono">{pens?.home ?? 0}–{pens?.away ?? 0}</span></div>
    </div>
    </div>
  </div>
</div>

<style>
  .bug {
    position: absolute;
    left: calc(64px / 1.2);
    top: calc(54px / 1.2);
    zoom: 1.2;
    visibility: hidden;
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.45));
  }
  .bar {
    position: relative;
    display: flex;
    height: 54px;
  }
  .team {
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 18px 0 20px;
    overflow: hidden;
  }
  .team.away {
    flex-direction: row-reverse;
    padding: 0 20px 0 18px;
  }
  .stripe,
  .flood {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    background: var(--c);
  }
  .stripe {
    width: 5px;
    transform-origin: 50% 0;
  }
  .away .stripe {
    left: auto;
    right: 0;
  }
  .flood {
    right: 0;
    transform: scaleX(0);
  }
  .team > :not(i) {
    position: relative;
  }
  .chip {
    width: 30px;
    height: 30px;
  }
  .code {
    font-size: 25px;
    letter-spacing: 0.03em;
  }
  .score {
    display: flex;
    gap: 1px;
    font-size: 31px;
    font-weight: 800;
  }
  .digit {
    display: grid;
    place-items: center;
    min-width: 50px;
    padding: 0 4px;
    background: var(--bg2);
    overflow: hidden;
  }
  .time {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 20px;
    border-left: 1px solid var(--hair);
  }
  .per {
    font-size: 12.5px;
  }
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin: 0 8px 1px 0;
    border-radius: 50%;
    background: var(--mut);
  }
  .dot.live {
    background: var(--ac);
    animation: live 1.6s ease-in-out infinite;
  }
  @keyframes live {
    50% {
      opacity: 0.25;
    }
  }
  .clock {
    font-size: 23px;
    min-width: 72px;
  }
  /* Avancement de la période ; il passe en couleur d'accent dans le temps additionnel. */
  .prog {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: rgba(255, 255, 255, 0.1);
  }
  .prog i {
    display: block;
    height: 100%;
    background: rgba(255, 255, 255, 0.65);
    transform-origin: 0 50%;
    transition: background 0.4s;
  }
  .prog.over i {
    background: var(--ac);
  }
  .tags {
    position: absolute;
    left: 100%;
    top: 2px;
  }
  .extra {
    display: grid;
  }
  .tag {
    grid-area: 1 / 1;
    height: 54px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    white-space: nowrap;
  }
  .t-add {
    --r: 0;
    background: var(--ac);
    color: #0d0f13;
    font-size: 23px;
    font-weight: 800;
  }
  .t-add small {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    --wd: 100;
    font-variation-settings: 'wdth' 100;
  }

  /* Vertical : barre centrée en haut, la période dans un onglet dessous. */
  :global(.tall) .bug {
    left: 50%;
    top: calc(var(--safe-top) / 1.5);
    zoom: 1.5;
    transform: translateX(-50%);
  }
  :global(.tall) .tags {
    left: 0;
    right: 0;
    top: 100%;
    display: flex;
    justify-content: center;
    margin-top: 3px;
  }
  :global(.tall) .tag {
    height: 32px;
  }
  :global(.tall) .t-per {
    font-size: 13.5px;
    color: #c9ced6;
  }
  :global(.tall) .tw {
    position: relative;
  }
  :global(.tall) .extra {
    position: absolute;
    left: 100%;
    top: 0;
    margin-left: 3px;
  }
  :global(.tall) .t-add {
    font-size: 17px;
  }
</style>
