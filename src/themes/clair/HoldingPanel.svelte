<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { Config, TeamId } from '../../shared/types';
  import { fit, leave, POP, softFrom, softTo, SPRING } from './motion';
  import './clair.css';

  // Écran d'attente : fond clair, grands disques aux couleurs des équipes qui dérivent lentement,
  // le message dans une carte blanche avec trois billes qui sautent à tour de rôle.
  let { config, leaving, ongone }: { config: Config; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const teams: TeamId[] = ['home', 'away'];
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;
  let loops: gsap.core.Tween[] = [];

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.back'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.blob'), { scale: 0 }, { scale: 1, duration: 1.4, ease: SPRING, stagger: 0.12 }, 0.1)
      .fromTo(q('.title'), { scale: 0, rotation: -14 }, { scale: 1, rotation: -2, duration: 0.55, ease: 'back.out(2.2)' }, 0.4)
      .fromTo(q('.card'), { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.5)' }, 0.3)
      .fromTo(q('.badge'), { scale: 0 }, { scale: 1, duration: 1, ease: SPRING, stagger: 0.14 }, 0.5)
      .fromTo(q('.tx'), softFrom, { ...softTo, stagger: 0.12 }, 0.55)
      .fromTo(q('.dots i'), { scale: 0 }, { scale: 1, duration: 0.5, ease: POP, stagger: 0.08 }, 0.8);
    loops = [
      gsap.to(q('.dots i'), { y: -22, duration: 0.42, ease: 'power2.out', yoyo: true, repeat: -1, repeatDelay: 0.5, stagger: { each: 0.16, repeat: -1, yoyo: true }, delay: 1.4 }),
      ...q('.blob').map((el, i) => gsap.to(el, { x: i % 2 ? 60 : -60, y: i % 2 ? -40 : 50, duration: 7 + i * 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.5 })),
    ];
    return () => {
      tl?.kill();
      loops.forEach((l) => l.kill());
    };
  });

  $effect(() => {
    if (!leaving) return;
    tl?.kill();
    tl = leave(root, ongone);
  });
</script>

<div class="clair panel" bind:this={root} style:--home={config.teams.home.color} style:--away={config.teams.away.color}>
  <div class="back">
    <i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><i class="blob b4"></i>
  </div>
  <div class="col">
    <div class="title cap pop">{config.texts.title}</div>
    <div class="card">
      <div class="badges">
        {#each teams as id (id)}
          {@const t = config.teams[id]}
          <span class="disc badge pop" class:light={t.logoOnLight} style:--c={t.color}><img src={t.logo} alt="" /></span>
        {/each}
      </div>
      <span class="msg tx" style:font-size="{fit(config.texts.holding, tall ? 74 : 92, tall ? 1500 : 2300)}px">{config.texts.holding}</span>
      <div class="dots"><i></i><i></i><i></i></div>
      <span class="subtitle tx">{config.texts.subtitle}</span>
    </div>
  </div>
</div>

<style>
  .back {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #eef1f5;
  }
  .blob {
    position: absolute;
    border-radius: 50%;
  }
  .b1 {
    left: -160px;
    top: -200px;
    width: 720px;
    height: 720px;
    background: var(--home);
  }
  .b2 {
    right: -220px;
    bottom: -280px;
    width: 860px;
    height: 860px;
    background: var(--away);
  }
  .b3 {
    right: 240px;
    top: 90px;
    width: 150px;
    height: 150px;
    background: var(--sun);
  }
  .b4 {
    left: 300px;
    bottom: 110px;
    width: 96px;
    height: 96px;
    background: var(--ink);
  }
  .col {
    gap: 0 !important;
  }
  .title {
    position: relative;
    z-index: 1;
    height: 56px;
    padding: 0 30px;
    margin-bottom: -22px;
    font-size: 26px;
    font-weight: 800;
  }
  .card {
    width: 100%;
    padding: 70px 60px 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 26px;
    text-align: center;
  }
  .badges {
    display: flex;
    --ring: 6px;
  }
  .badge {
    width: 110px;
    height: 110px;
    box-shadow: 0 0 0 8px #fff;
  }
  .badge.light {
    box-shadow:
      inset 0 0 0 6px var(--c),
      0 0 0 8px #fff;
  }
  .badge + .badge {
    margin-left: -18px;
  }
  .msg {
    font-weight: 800;
    font-stretch: 80%;
  }
  .dots {
    display: flex;
    gap: 14px;
    height: 22px;
    margin-top: 16px;
  }
  .dots i {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--ink);
  }
  .dots i:nth-child(1) {
    background: var(--home);
  }
  .dots i:nth-child(3) {
    background: var(--away);
  }
  .subtitle {
    font-size: 24px;
    font-weight: 600;
    color: var(--soft);
  }
  :global(.tall) .card {
    padding: 70px 36px 56px;
  }
  :global(.tall) .b1 {
    width: 560px;
    height: 560px;
  }
  :global(.tall) .b2 {
    width: 700px;
    height: 700px;
  }
  :global(.tall) .b3 {
    right: 90px;
    top: 330px;
  }
  :global(.tall) .b4 {
    left: 110px;
    bottom: 420px;
  }
</style>
