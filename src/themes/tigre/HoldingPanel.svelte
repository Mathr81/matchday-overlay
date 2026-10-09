<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import type { Config } from '../../shared/types';
  import { leave, OUT } from './motion';
  import './tigre.css';

  // Écran d'attente : couvre toute l'image, bandes qui défilent sans fin.
  let { config, leaving, ongone }: { config: Config; leaving: boolean; ongone: () => void } = $props();

  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;
  let loops: gsap.core.Tween[] = [];

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.back'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.strip'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: OUT, transformOrigin: '0 50%', stagger: 0.08 }, 0.15)
      .fromTo(q('.title, .subtitle'), { '--p': 0 }, { '--p': 1, duration: 0.5, ease: OUT, stagger: 0.1 }, 0.5)
      .fromTo(q('.title > *, .subtitle > *'), { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, stagger: 0.1 }, 0.65);
    // Chaque bande répète son texte : avancer d'une demi-longueur donne une boucle sans raccord.
    loops = q('.run').map((el, i) => gsap.fromTo(el, { xPercent: i % 2 ? -50 : 0 }, { xPercent: i % 2 ? 0 : -50, duration: i % 2 ? 46 : 30, ease: 'none', repeat: -1 }));
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

<div class="tigre panel" bind:this={root}>
  <div class="back"></div>
  <div class="rot">
    <div class="strip thin"></div>
    <div class="strip big">
      <div class="run">{#each Array(8) as _, i (i)}<span>{config.texts.holding}</span><em>///</em>{/each}</div>
    </div>
    <div class="strip small">
      <div class="run">{#each Array(16) as _, i (i)}<span>{config.texts.title}</span><em>///</em>{/each}</div>
    </div>
  </div>
  <div class="title para"><span>{config.texts.title}</span></div>
  <div class="subtitle para"><span>{config.texts.subtitle}</span></div>
</div>

<style>
  .back {
    position: absolute;
    inset: 0;
    background-color: var(--k);
    background-image: repeating-linear-gradient(104deg, rgba(255, 255, 255, 0.035) 0 2px, transparent 2px 16px);
  }
  .rot {
    position: absolute;
    left: -240px;
    top: 330px;
    width: 2400px;
    transform: rotate(-8deg);
  }
  .strip {
    overflow: hidden;
    white-space: nowrap;
  }
  .thin {
    height: 20px;
    background: var(--w);
    margin-bottom: 14px;
  }
  .big {
    height: 300px;
    background-color: var(--o);
    background-image: repeating-linear-gradient(104deg, rgba(0, 0, 0, 0.075) 0 3px, transparent 3px 18px);
    color: var(--k);
    font-size: 170px;
    line-height: 306px;
    --wd: 110;
  }
  .small {
    height: 56px;
    margin-top: 14px;
    background: #1a1a1a;
    font-size: 26px;
    line-height: 58px;
    font-weight: 800;
    letter-spacing: 0.16em;
    --wd: 88;
  }
  .run {
    display: inline-block;
  }
  .big em {
    font-style: inherit;
    margin: 0 70px;
    opacity: 0.35;
  }
  .small em {
    font-style: inherit;
    margin: 0 22px;
    color: var(--o);
  }
  .title {
    position: absolute;
    left: 190px;
    top: 120px;
    height: 76px;
    --s: 19px;
    padding: 0 46px 0 48px;
    display: flex;
    align-items: center;
    background: var(--w);
    color: var(--k);
    font-size: 44px;
    --wd: 100;
  }
  .subtitle {
    position: absolute;
    left: 172px;
    top: 202px;
    height: 44px;
    --s: 11px;
    padding: 0 32px 0 30px;
    display: flex;
    align-items: center;
    background: var(--o);
    color: var(--k);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.12em;
    --wd: 88;
  }
</style>
