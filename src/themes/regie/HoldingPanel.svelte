<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { Config } from '../../shared/types';
  import { fit, leave, OUT } from './motion';
  import './regie.css';

  // Écran d'attente : couvre toute l'image. Un cadre de visée se trace autour du message,
  // et un signal parcourt le trait en boucle tant que l'écran reste affiché.
  let { config, leaving, ongone }: { config: Config; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;
  let loops: gsap.core.Tween[] = [];

  onMount(() => {
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.back'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.corner'), { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.7, ease: OUT, stagger: 0.06 }, 0.15)
      .fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: OUT, transformOrigin: '50% 50%' }, 0.3)
      .fromTo(q('.rise'), { yPercent: 115 }, { yPercent: 0, duration: 0.6, ease: OUT, stagger: 0.1 }, 0.4)
      .fromTo(q('.msg'), { letterSpacing: '0.2em' }, { letterSpacing: '0.01em', duration: 1.2, ease: OUT }, 0.4);
    loops = [
      gsap.fromTo(q('.pulse'), { xPercent: -100 }, { xPercent: 500, duration: 2.4, ease: 'power1.inOut', repeat: -1, repeatDelay: 0.5, delay: 1 }),
      gsap.fromTo(q('.scan'), { yPercent: -100 }, { yPercent: 2500, duration: 9, ease: 'none', repeat: -1 }),
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

<div class="regie panel" bind:this={root}>
  <div class="back"><i class="scan"></i></div>
  <div class="frame">
    <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
    <span class="up"><span class="rise lab top">{config.texts.title}</span></span>
    <span class="up"><span class="rise msg" style:font-size="{fit(config.texts.holding, tall ? 84 : 104, tall ? 1500 : 2500)}px">{config.texts.holding}</span></span>
    <div class="rule"><i class="pulse"></i></div>
    <span class="up"><span class="rise lab">{config.texts.subtitle}</span></span>
  </div>
</div>

<style>
  .back {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background-color: #0a0c0f;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
    background-size: 60px 60px;
  }
  /* Bande claire très légère qui descend l'écran. */
  .scan {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 4%;
    background: linear-gradient(transparent, rgba(255, 255, 255, 0.035), transparent);
  }
  .frame {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1320px;
    transform: translate(-50%, -50%);
    padding: 90px 80px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 30px;
    text-align: center;
  }
  .corner {
    position: absolute;
    width: 44px;
    height: 44px;
    border: 2px solid var(--tx);
  }
  .tl {
    left: 0;
    top: 0;
    border-right: 0;
    border-bottom: 0;
    transform-origin: 0 0;
  }
  .tr {
    right: 0;
    top: 0;
    border-left: 0;
    border-bottom: 0;
    transform-origin: 100% 0;
  }
  .bl {
    left: 0;
    bottom: 0;
    border-right: 0;
    border-top: 0;
    transform-origin: 0 100%;
  }
  .br {
    right: 0;
    bottom: 0;
    border-left: 0;
    border-top: 0;
    transform-origin: 100% 100%;
  }
  .top {
    font-size: 19px;
    color: var(--ac);
  }
  .msg {
    font-weight: 900;
    --wd: 90;
  }
  .rule {
    position: relative;
    width: 460px;
    background: rgba(255, 255, 255, 0.2);
    overflow: hidden;
  }
  .pulse {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 20%;
    background: var(--ac);
  }
  .frame > :global(.up:last-child .lab) {
    font-size: 17px;
  }
  :global(.tall) .frame {
    width: 960px;
    top: 44%;
    padding: 110px 50px;
  }
</style>
