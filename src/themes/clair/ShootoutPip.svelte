<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';

  // Une bille de la séance : creuse, qui respire pour le prochain tireur, puis verte (marqué) ou rouge barrée (raté).
  let { result, current, extra }: { result: boolean | null; current: boolean; /** Bille ajoutée pour la mort subite. */ extra: boolean } = $props();

  let root: HTMLDivElement;
  let fill = $state<HTMLDivElement>();
  let seen: boolean | null = null;

  onMount(() => {
    seen = result;
    if (extra) gsap.from(root, { width: 0, marginRight: -8, scale: 0, duration: 0.6, ease: 'back.out(2)' });
  });

  $effect(() => {
    const now = result;
    if (now === seen || !fill) return;
    seen = now;
    if (now !== null) gsap.fromTo(fill, { scale: 0 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
  });
</script>

<div class="pip" class:current bind:this={root}>
  {#if result !== null}<div class="fill" class:ok={result} class:ko={!result} bind:this={fill}></div>{/if}
</div>

<style>
  .pip {
    position: relative;
    width: var(--pw, 36px);
    height: var(--pw, 36px);
    flex: none;
    border-radius: 50%;
    background: #eceef2;
  }
  .current {
    animation: breathe 0.8s ease-in-out infinite alternate;
    box-shadow: inset 0 0 0 4px #14161a;
    background: #fff;
  }
  @keyframes breathe {
    to {
      transform: scale(0.72);
    }
  }
  .fill {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }
  .ok {
    background: #12b76a;
  }
  .ko {
    background: #e5383b;
  }
  .ko::before,
  .ko::after {
    content: '';
    position: absolute;
    left: 24%;
    right: 24%;
    top: 50%;
    height: 4px;
    margin-top: -2px;
    border-radius: 2px;
    background: #fff;
    transform: rotate(45deg);
  }
  .ko::after {
    transform: rotate(-45deg);
  }
</style>
