<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import { formatClock, periodLabel } from '../../shared/clock';
  import type { Config, MatchState } from '../../shared/types';
  import RollNumber from './RollNumber.svelte';
  import './tigre.css';

  let { config, match, visible, offset }: { config: Config; match: MatchState; visible: boolean; offset: number } = $props();

  const OUT = 'expo.out';
  let root: HTMLDivElement;
  let addTag: HTMLDivElement;
  let timeline: gsap.core.Timeline | null = null;
  let shown = false;
  let lastTotal: number | null = null;
  let clockText = $state('00:00');
  // Garde la dernière valeur pendant que l'étiquette se referme.
  let addedText = $state(0);

  const home = $derived(config.teams.home);
  const away = $derived(config.teams.away);
  const readClock = () => formatClock(match.clock, config.format, Date.now() + offset);

  onMount(() => {
    const id = setInterval(() => (clockText = readClock()), 200);
    return () => {
      clearInterval(id);
      timeline?.kill();
    };
  });

  $effect(() => {
    clockText = readClock();
  });

  function enter() {
    const q = gsap.utils.selector(root);
    return gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .set(q('.seg, .t-per'), { '--q': 0 })
      .fromTo(q('.seg'), { '--p': 0 }, { '--p': 1, duration: 0.6, ease: OUT, stagger: 0.07 }, 0)
      .fromTo(q('.seg > *'), { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: OUT, stagger: 0.035 }, 0.16)
      .fromTo(q('.s-home .logo'), { rotation: -40, scale: 0.2 }, { rotation: 0, scale: 1, duration: 0.6, ease: 'back.out(2.2)' }, 0.2)
      .fromTo(q('.t-per'), { '--p': 0 }, { '--p': 1, duration: 0.45, ease: OUT }, 0.55)
      .fromTo(q('.t-per > *'), { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 }, 0.68);
  }

  function exit() {
    const q = gsap.utils.selector(root);
    return gsap
      .timeline()
      .to(q('.t-per'), { '--q': 1, duration: 0.3, ease: 'power3.in' }, 0)
      .to(q('.seg > *'), { y: -40, opacity: 0, duration: 0.25, ease: 'power3.in', stagger: 0.02 }, 0)
      .to(q('.seg'), { '--q': 1, duration: 0.45, ease: 'expo.inOut', stagger: 0.05 }, 0.1)
      .set(root, { autoAlpha: 0 });
  }

  $effect(() => {
    const want = visible;
    if (!root || want === shown) return;
    shown = want;
    timeline?.kill();
    timeline = want ? enter() : exit();
  });

  // Temps additionnel : l'étiquette « +3 » s'ouvre et se referme toute seule.
  $effect(() => {
    const minutes = match.clock.addedMinutes;
    const open = visible && minutes !== null && minutes > 0;
    if (open) addedText = minutes;
    if (addTag) gsap.to(addTag, { '--p': open ? 1 : 0, duration: 0.45, ease: open ? OUT : 'power3.in', delay: open ? 0.3 : 0 });
  });

  // Changement de score : éclat orange sur le bloc et petit sursaut de l'ensemble.
  $effect(() => {
    const total = match.score.home + match.score.away;
    if (lastTotal !== null && total !== lastTotal && root && shown) {
      const q = gsap.utils.selector(root);
      gsap.fromTo(q('.s-score'), { backgroundColor: '#EF5407' }, { backgroundColor: '#0A0A0A', duration: 0.7, ease: 'power2.out', delay: 0.3 });
      gsap.fromTo(root, { scale: 1 }, { scale: 1.07, duration: 0.14, ease: 'power2.out', yoyo: true, repeat: 1, delay: 0.25 });
    }
    lastTotal = total;
  });
</script>

<div class="tigre bug" bind:this={root} style:--home={home.color} style:--away={away.color}>
  <div class="row">
    <div class="seg para s-home">
      <span class="logo" class:chip={home.logoOnLight}><img src={home.logo} alt="" /></span>
      <span>{home.code}</span>
    </div>
    <div class="seg para hatch s-score">
      <RollNumber value={match.score.home} />
      <i class="slash"></i>
      <RollNumber value={match.score.away} />
    </div>
    <div class="seg para s-away">
      <span>{away.code}</span>
      <span class="logo" class:chip={away.logoOnLight}><img src={away.logo} alt="" /></span>
    </div>
    <div class="seg para s-clock"><span>{clockText}</span></div>
  </div>
  <div class="sub">
    <div class="tag para t-per"><span>{periodLabel(match.clock, config.format)}</span></div>
    <div class="tag para t-add" bind:this={addTag}><span>+{addedText}</span></div>
  </div>
</div>

<style>
  .bug {
    position: absolute;
    left: 80px;
    top: 60px;
    visibility: hidden;
    transform-origin: 0 0;
    filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.5));
  }
  .row {
    display: flex;
  }
  .seg {
    height: 64px;
    --s: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 30px 0 32px;
    margin-right: -10px;
    font-size: 31px;
    font-weight: 800;
    --wd: 80;
  }
  .s-home {
    background: var(--home);
  }
  .s-away {
    background: var(--away);
  }
  .logo {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
  }
  .logo img {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }
  /* Logo sombre : posé sur une pastille claire inclinée. */
  .logo.chip {
    width: 50px;
    height: 42px;
    background: var(--w);
    clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  }
  .logo.chip img {
    max-width: 30px;
    max-height: 34px;
  }
  .s-score {
    background-color: var(--k);
    gap: 10px;
    padding: 0 26px 0 28px;
    font-size: 50px;
    font-weight: 900;
    --wd: 100;
  }
  .slash {
    width: 6px;
    height: 30px;
    background: var(--o);
    transform: skewX(-14deg);
  }
  .s-clock {
    background: var(--w);
    color: var(--k);
    margin-left: 8px;
    min-width: 156px;
    justify-content: center;
    font-size: 32px;
    --wd: 92;
    font-variant-numeric: tabular-nums;
  }
  .sub {
    display: flex;
    margin: 6px 0 0 -9px;
  }
  .tag {
    height: 30px;
    --s: 7.5px;
    display: flex;
    align-items: center;
    padding: 0 20px 0 22px;
    margin-right: -3px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.13em;
    --wd: 88;
  }
  .t-per {
    background: rgba(10, 10, 10, 0.94);
  }
  .t-add {
    --p: 0;
    background: var(--o);
    color: var(--k);
    font-size: 18px;
    letter-spacing: 0.04em;
  }
</style>
