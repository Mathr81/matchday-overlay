<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';

  // Une case de la séance : vide, en attente du tireur, puis tamponnée verte (marqué) ou rouge barrée (raté).
  let { result, current, extra }: { result: boolean | null; current: boolean; /** Case ajoutée pour la mort subite. */ extra: boolean } = $props();

  let root: HTMLDivElement;
  let fill = $state<HTMLDivElement>();
  let seen: boolean | null = null;

  onMount(() => {
    seen = result;
    // Une case de mort subite s'ouvre en poussant les autres ; celles de la série sont là dès le départ.
    if (extra) gsap.from(root, { width: 0, duration: 0.5, ease: 'back.out(1.8)' });
  });

  $effect(() => {
    const now = result;
    if (now === seen || !fill) return;
    seen = now;
    if (now !== null) gsap.fromTo(fill, { scale: 2.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2.2)' });
  });
</script>

<div class="pip" class:current bind:this={root}>
  {#if result !== null}<div class="fill" class:ok={result} class:ko={!result} bind:this={fill}></div>{/if}
</div>

<style>
  .pip {
    width: var(--pw, 58px);
    height: 38px;
    margin-right: -4px;
    position: relative;
    flex: none;
    clip-path: polygon(9.5px 0, 100% 0, calc(100% - 9.5px) 100%, 0 100%);
    background: rgba(255, 255, 255, 0.14);
    overflow: hidden;
  }
  /* Case du prochain tireur : elle clignote en orange. */
  .current::before {
    content: '';
    position: absolute;
    inset: 0;
    background: #ef5407;
    animation: wait 0.9s ease-in-out infinite alternate;
  }
  @keyframes wait {
    from {
      opacity: 0.15;
    }
    to {
      opacity: 0.85;
    }
  }
  .fill {
    position: absolute;
    inset: 0;
  }
  .ok {
    background: #23d17a;
  }
  .ko {
    background: #f0323c;
  }
  .ko::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -20%;
    width: 6px;
    height: 140%;
    margin-left: -3px;
    background: #0a0a0a;
    transform: rotate(38deg);
  }
</style>
