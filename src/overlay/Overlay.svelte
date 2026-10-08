<script lang="ts">
  import { onMount } from 'svelte';
  import { connect } from '../client/connection';
  import type { Snapshot } from '../shared/types';
  import Scorebug from '../themes/tigre/Scorebug.svelte';

  let snapshot = $state<Snapshot | null>(null);
  let offset = $state(0);
  let scale = $state(1);

  onMount(() => {
    const connection = connect('overlay', {
      onSnapshot: (s, o) => {
        snapshot = s;
        offset = o;
      },
    });
    // La scène fait toujours 1920×1080 ; elle est réduite pour tenir dans une fenêtre plus petite.
    const fit = () => (scale = Math.min(innerWidth / 1920, innerHeight / 1080));
    fit();
    addEventListener('resize', fit);
    return () => {
      connection.close();
      removeEventListener('resize', fit);
    };
  });
</script>

<div class="stage" style:transform="scale({scale})">
  {#if snapshot}
    <Scorebug config={snapshot.config} match={snapshot.match} visible={snapshot.display.scoreVisible} {offset} />
  {/if}
</div>

<style>
  :global(html, body) {
    margin: 0;
    background: transparent;
    overflow: hidden;
  }
  .stage {
    position: absolute;
    left: 0;
    top: 0;
    width: 1920px;
    height: 1080px;
    transform-origin: 0 0;
    overflow: hidden;
  }
</style>
