<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import type { Config } from '../../shared/types';
  import { inkOn, leave, letters, OUT } from './motion';
  import './tigre.css';

  // Affiche du match : les deux équipes se rejoignent au centre, compte à rebours en dessous.
  let { config, kickoffAt, offset, leaving, ongone }: { config: Config; kickoffAt?: number; offset: number; leaving: boolean; ongone: () => void } = $props();

  const home = $derived(config.teams.home);
  const away = $derived(config.teams.away);
  const size = (name: string) => Math.min(120, Math.round(540 / (name.length * 0.74)));
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;
  let remaining = $state<number | null>(null);

  const countdown = $derived.by(() => {
    if (remaining === null) return '';
    if (remaining <= 0) return "C'est parti";
    const s = Math.ceil(remaining / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  onMount(() => {
    const tick = () => (remaining = kickoffAt === undefined ? null : kickoffAt - (Date.now() + offset));
    tick();
    const id = setInterval(tick, 200);
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.shade'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.home'), { x: -1200 }, { x: 0, duration: 0.8, ease: OUT }, 0.1)
      .fromTo(q('.away'), { x: 1200 }, { x: 0, duration: 0.8, ease: OUT }, 0.1)
      .fromTo(q('.vs'), { '--p': 0 }, { '--p': 1, duration: 0.4, ease: OUT }, 0.6)
      .fromTo(q('.vs span'), { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0.7)
      .fromTo(q('.half .crest'), { scale: 0.2, rotation: -30, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.8)', stagger: 0.1 }, 0.45)
      .fromTo(q('.name .ch > span'), { yPercent: 115 }, { yPercent: 0, duration: 0.6, ease: OUT, stagger: 0.02 }, 0.55)
      .fromTo(q('.name'), { '--wd': 50 }, { '--wd': 100, duration: 1.1, ease: OUT }, 0.55)
      .fromTo(q('.title, .subtitle'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.1 }, 0.3)
      .fromTo(q('.title > *, .subtitle > *'), { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, stagger: 0.1 }, 0.45)
      .fromTo(q('.count-label, .count'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.1 }, 0.9)
      .fromTo(q('.count > *, .count-label > *'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: OUT, stagger: 0.08 }, 1);
    return () => {
      clearInterval(id);
      tl?.kill();
    };
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="tigre panel" bind:this={root}>
  <div class="shade"></div>
  <div class="title para"><span>{config.texts.title}</span></div>
  <div class="subtitle para"><span>{config.texts.subtitle}</span></div>

  <div class="half home para" style:background-color={home.color} style:color={inkOn(home.color)}>
    <div class="crest" class:chip={home.logoOnLight}><img src={home.logo} alt="" /></div>
    <div class="name" style:font-size="{size(home.name)}px">{#each letters(home.name) as c, i (i)}<span class="ch"><span>{c}</span></span>{/each}</div>
  </div>
  <div class="vs para"><span>vs</span></div>
  <div class="half away para" style:background-color={away.color} style:color={inkOn(away.color)}>
    <div class="name" style:font-size="{size(away.name)}px">{#each letters(away.name) as c, i (i)}<span class="ch"><span>{c}</span></span>{/each}</div>
    <div class="crest" class:chip={away.logoOnLight}><img src={away.logo} alt="" /></div>
  </div>

  {#if countdown}
    <div class="count-label para"><span>{remaining !== null && remaining > 0 ? "Coup d'envoi dans" : "Coup d'envoi"}</span></div>
    <div class="count para"><span>{countdown}</span></div>
  {/if}
</div>

<style>
  .title {
    position: absolute;
    left: 190px;
    top: 150px;
    height: 76px;
    --s: 19px;
    padding: 0 46px 0 48px;
    display: flex;
    align-items: center;
    background: var(--o);
    color: var(--k);
    font-size: 44px;
    --wd: 100;
  }
  .subtitle {
    position: absolute;
    left: 172px;
    top: 232px;
    height: 44px;
    --s: 11px;
    padding: 0 32px 0 30px;
    display: flex;
    align-items: center;
    background: var(--w);
    color: var(--k);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.12em;
    --wd: 88;
  }
  /* Les deux moitiés ont la même inclinaison et laissent entre elles la place du « vs ». */
  .half {
    position: absolute;
    top: 330px;
    width: 1020px;
    height: 400px;
    --s: 100px;
    display: flex;
    align-items: center;
    gap: 30px;
    background-image: repeating-linear-gradient(104deg, rgba(0, 0, 0, 0.075) 0 3px, transparent 3px 18px);
  }
  .home {
    left: -60px;
    padding: 0 130px 0 110px;
    justify-content: flex-end;
  }
  .away {
    left: 960px;
    padding: 0 110px 0 130px;
  }
  .half .crest {
    width: 200px;
    height: 200px;
  }
  .name {
    white-space: nowrap;
  }
  .vs {
    position: absolute;
    left: 860px;
    top: 330px;
    width: 200px;
    height: 400px;
    --s: 100px;
    background: var(--k);
    display: grid;
    place-items: center;
    font-size: 54px;
    --wd: 60;
    color: var(--o);
  }
  .count-label {
    position: absolute;
    left: 742px;
    top: 770px;
    height: 40px;
    --s: 10px;
    padding: 0 30px 0 28px;
    display: flex;
    align-items: center;
    background: var(--o);
    color: var(--k);
    font-size: 19px;
    font-weight: 800;
    letter-spacing: 0.14em;
    --wd: 88;
  }
  .count {
    position: absolute;
    left: 706px;
    top: 816px;
    height: 124px;
    --s: 31px;
    min-width: 470px;
    padding: 0 70px;
    display: grid;
    place-items: center;
    background: var(--w);
    color: var(--k);
    font-size: 84px;
    --wd: 100;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
