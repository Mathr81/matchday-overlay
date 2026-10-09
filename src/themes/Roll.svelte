<script lang="ts">
  import gsap from 'gsap';
  import { tick, untrack } from 'svelte';

  // Chiffre qui roule : le nouveau pousse l'ancien, vers le haut si la valeur monte, vers le bas si elle est corrigée.
  // Dimensions en em : il prend la taille du texte autour de lui.
  let { value, duration = 0.6, ease = 'expo.inOut' }: { value: number; duration?: number; ease?: string } = $props();

  let inner: HTMLSpanElement;
  let shown = untrack(() => value);
  let top = $state(shown);
  let bottom = $state(shown);

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
          duration,
          ease,
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
    height: 1.2em;
    overflow: hidden;
  }
  .inner {
    display: block;
  }
  b {
    display: block;
    height: 1.2em;
    line-height: 1.2em;
    font-weight: inherit;
    text-align: center;
  }
</style>
