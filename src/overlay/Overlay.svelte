<script lang="ts">
  import { onMount } from 'svelte';
  import { connect } from '../client/connection';
  import type { Cue, Snapshot, TeamId } from '../shared/types';
  import Moment from '../themes/tigre/Moment.svelte';
  import Scorebug from '../themes/tigre/Scorebug.svelte';

  let snapshot = $state<Snapshot | null>(null);
  let offset = $state(0);
  let scale = $state(1);

  // File des moments : un seul à la fois ; s'il y en a un qui attend, celui en cours écourte sa sortie.
  let queue = $state<Cue[]>([]);
  let current = $state<Cue | null>(null);
  // Score retenu pendant l'animation d'un but : il ne roule qu'au moment choisi par le thème.
  let heldScore = $state<Record<TeamId, number> | null>(null);

  const match = $derived(snapshot && heldScore ? { ...snapshot.match, score: heldScore } : snapshot?.match);

  function next() {
    current = queue.shift() ?? null;
  }
  function onCue(cue: Cue) {
    if (cue.type === 'goal' && !heldScore && snapshot) heldScore = { ...snapshot.match.score };
    queue.push(cue);
    if (!current) next();
  }
  function done() {
    heldScore = null;
    next();
  }

  onMount(() => {
    const connection = connect('overlay', {
      onSnapshot: (s, o) => {
        snapshot = s;
        offset = o;
      },
      onCue,
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
  {#if snapshot && match}
    <Scorebug config={snapshot.config} {match} visible={snapshot.display.scoreVisible} {offset} />
    {#if current}
      {#key current.id}
        <Moment cue={current} config={snapshot.config} hurry={queue.length > 0} onscore={() => (heldScore = null)} ondone={done} />
      {/key}
    {/if}
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
