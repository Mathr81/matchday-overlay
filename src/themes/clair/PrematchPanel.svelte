<script lang="ts">
  import gsap from 'gsap';
  import { getContext, onMount } from 'svelte';
  import type { Config, TeamId } from '../../shared/types';
  import { countdownText, fit } from '../util';
  import { leave, POP, softFrom, softTo, SPRING } from './motion';
  import './clair.css';

  // Affiche du match : une grande carte blanche, les deux disques des équipes qui rebondissent,
  // le « vs » entre eux, le compte à rebours dans une capsule sombre.
  let { config, kickoffAt, offset, leaving, ongone }: { config: Config; kickoffAt?: number; offset: number; leaving: boolean; ongone: () => void } = $props();

  const tall = getContext<boolean>('tall') ?? false;
  const teams: TeamId[] = ['home', 'away'];
  let root: HTMLDivElement;
  let tl: gsap.core.Timeline | undefined;
  let remaining = $state<number | null>(null);
  const countdown = $derived(countdownText(remaining));

  onMount(() => {
    const tick = () => (remaining = kickoffAt === undefined ? null : kickoffAt - (Date.now() + offset));
    tick();
    const id = setInterval(tick, 200);
    const q = gsap.utils.selector(root);
    tl = gsap
      .timeline()
      .set(root, { autoAlpha: 1 })
      .fromTo(q('.shade'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(q('.card'), { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.5)' }, 0.1)
      .fromTo(q('.head .tx'), softFrom, { ...softTo, stagger: 0.1 }, 0.35)
      .fromTo(q('.side .disc'), { scale: 0, rotation: (i: number) => (i ? 60 : -60) }, { scale: 1, rotation: 0, duration: 1.1, ease: SPRING, stagger: 0.16 }, 0.4)
      .fromTo(q('.name'), softFrom, { ...softTo, stagger: 0.16 }, 0.65)
      .fromTo(q('.vs'), { scale: 0, rotation: -180 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2)' }, 0.75)
      .fromTo(q('.count'), { scale: 0.5, y: -30, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: POP }, 0.95)
      .to(q('.side .disc'), { y: -10, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.8 }, 1.8);
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

<div class="clair panel" bind:this={root}>
  <div class="shade"></div>
  <div class="col">
    <div class="card">
      <div class="head">
        <span class="title tx" style:font-size="{fit(config.texts.title, 46, tall ? 1500 : 2200)}px">{config.texts.title}</span>
        <span class="subtitle tx">{config.texts.subtitle}</span>
      </div>
      <div class="teams">
        {#each teams as id (id)}
          {@const t = config.teams[id]}
          <div class="side" style:--c={t.color}>
            <span class="disc pop" class:light={t.logoOnLight}><img src={t.logo} alt="" /></span>
            <span class="name" style:font-size="{fit(t.name, 62, tall ? 600 : 760)}px">{t.name}</span>
          </div>
          {#if id === 'home'}<span class="vs cap pop">vs</span>{/if}
        {/each}
      </div>
    </div>
    {#if countdown}
      <div class="count cap pop">
        <span>{remaining !== null && remaining > 0 ? "Coup d'envoi dans" : "Coup d'envoi"}</span>
        <b>{countdown}</b>
      </div>
    {/if}
  </div>
</div>

<style>
  .card {
    width: 100%;
    padding: 54px 60px 70px;
  }
  .head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  .title {
    font-weight: 800;
  }
  .subtitle {
    font-size: 23px;
    font-weight: 600;
    color: var(--soft);
  }
  .teams {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 50px;
    margin-top: 50px;
  }
  .side {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 26px;
    min-width: 0;
    --ring: 12px;
  }
  .side .disc {
    width: 250px;
    height: 250px;
  }
  .name {
    font-weight: 800;
    white-space: nowrap;
  }
  .vs {
    justify-content: center;
    width: 84px;
    height: 84px;
    margin-bottom: 80px;
    font-size: 30px;
    font-weight: 800;
    flex: none;
  }
  .count {
    gap: 24px;
    height: 110px;
    padding: 0 50px;
    margin-top: -64px;
    position: relative;
  }
  .count span {
    font-size: 22px;
    font-weight: 600;
    opacity: 0.75;
  }
  .count b {
    font-size: 70px;
    font-weight: 800;
  }

  :global(.tall) .card {
    padding: 50px 40px 80px;
  }
  :global(.tall) .teams {
    flex-direction: column;
    gap: 22px;
    margin-top: 40px;
  }
  :global(.tall) .side .disc {
    width: 230px;
    height: 230px;
  }
  :global(.tall) .vs {
    margin-bottom: 0;
  }
  :global(.tall) .count {
    height: 100px;
  }
  :global(.tall) .count b {
    font-size: 62px;
  }
</style>
