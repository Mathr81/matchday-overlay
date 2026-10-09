<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';

  // Un voyant de la séance : anneau vide, anneau qui pulse pour le prochain tireur, puis plein vert (marqué) ou croix rouge (raté).
  let { result, current, extra }: { result: boolean | null; current: boolean; /** Voyant ajouté pour la mort subite. */ extra: boolean } = $props();

  let root: HTMLDivElement;
  let fill = $state<HTMLDivElement>();
  let seen: boolean | null = null;

  onMount(() => {
    seen = result;
    if (extra) gsap.from(root, { width: 0, marginRight: -10, opacity: 0, duration: 0.5, ease: 'expo.out' });
  });

  $effect(() => {
    const now = result;
    if (now === seen || !fill) return;
    seen = now;
    if (now !== null) gsap.fromTo(fill, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
  });
</script>

<div class="pip" class:current bind:this={root}>
  {#if result !== null}<div class="fill" class:ok={result} class:ko={!result} bind:this={fill}></div>{/if}
</div>

<style>
  .pip {
    position: relative;
    width: var(--pw, 30px);
    height: var(--pw, 30px);
    flex: none;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.22);
  }
  .current {
    box-shadow: inset 0 0 0 2px #d4ff3a;
    animation: wait 0.9s ease-in-out infinite alternate;
  }
  @keyframes wait {
    from {
      opacity: 0.3;
    }
  }
  .fill {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }
  .ok {
    background: #35d683;
  }
  .ko {
    background: #ff4548;
  }
  /* Croix du tir raté. */
  .ko::before,
  .ko::after {
    content: '';
    position: absolute;
    left: 24%;
    right: 24%;
    top: 50%;
    height: 3px;
    margin-top: -1.5px;
    background: #0d0f13;
    transform: rotate(45deg);
  }
  .ko::after {
    transform: rotate(-45deg);
  }
</style>
