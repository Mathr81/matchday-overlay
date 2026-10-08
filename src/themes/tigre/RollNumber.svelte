<script lang="ts">
  import gsap from 'gsap';
  import { tick, untrack } from 'svelte';

  let { value }: { value: number } = $props();

  let inner: HTMLSpanElement;
  let shown = untrack(() => value);
  let top = $state(shown);
  let bottom = $state(shown);

  // Le nouveau chiffre pousse l'ancien : vers le haut si le score monte, vers le bas s'il est corrigé.
  $effect(() => {
    const next = value;
    if (next === shown || !inner) return;
    const up = next > shown;
    const from = shown;
    shown = next;
    gsap.killTweensOf(inner);
    top = up ? from : next;
    bottom = up ? next : from;
    tick().then(() =>
      gsap.fromTo(
        inner,
        { yPercent: up ? 0 : -50 },
        {
          yPercent: up ? -50 : 0,
          duration: 0.6,
          ease: 'expo.inOut',
          onComplete: () => {
            top = bottom = next;
            gsap.set(inner, { yPercent: 0 });
          },
        },
      ),
    );
  });
</script>

<span class="roll"><span class="inner" bind:this={inner}><b>{top}</b><b>{bottom}</b></span></span>

<style>
  .roll {
    display: block;
    height: 56px;
    overflow: hidden;
  }
  .inner {
    display: block;
  }
  b {
    display: block;
    height: 56px;
    line-height: 58px;
    padding: 0 7px;
    font-weight: 900;
  }
</style>
