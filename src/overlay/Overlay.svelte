<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { connect } from '../client/connection';
  import type { Banner, Cue, Panel as PanelData, Snapshot, TeamId } from '../shared/types';
  import FreeBanner from '../themes/tigre/FreeBanner.svelte';
  import Moment from '../themes/tigre/Moment.svelte';
  import Panel from '../themes/tigre/Panel.svelte';
  import Scorebug from '../themes/tigre/Scorebug.svelte';
  import { Slot } from './slot.svelte';

  let snapshot = $state<Snapshot | null>(null);
  let offset = $state(0);
  let scale = $state(1);

  // File des moments : un seul à la fois ; s'il y en a un qui attend, celui en cours écourte sa sortie.
  let queue = $state<Cue[]>([]);
  let current = $state<Cue | null>(null);
  // Score retenu pendant l'animation d'un but : il ne roule qu'au moment choisi par le thème.
  let heldScore = $state<Record<TeamId, number> | null>(null);

  const panel = new Slot<PanelData>();
  const banner = new Slot<Banner>();

  const match = $derived(snapshot && heldScore ? { ...snapshot.match, score: heldScore } : snapshot?.match);
  // Un panneau plein écran prend la place du score ; les stats le laissent visible.
  const covering = $derived(!!snapshot?.display.panel && snapshot.display.panel.type !== 'stats');

  $effect(() => {
    const want = snapshot?.display.panel ?? null;
    untrack(() => panel.set(want));
  });
  // Le bandeau libre partage l'emplacement des moments : il s'efface pendant qu'un moment joue, ou derrière un panneau.
  $effect(() => {
    const want = current || covering || snapshot?.display.panel ? null : (snapshot?.display.banner ?? null);
    untrack(() => banner.set(want));
  });

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
    <Scorebug config={snapshot.config} {match} visible={snapshot.display.scoreVisible && !covering} {offset} />
    {#if banner.shown}
      {#key banner.key}
        <FreeBanner banner={banner.shown} leaving={banner.leaving} ongone={banner.gone} />
      {/key}
    {/if}
    {#if panel.shown}
      {#key panel.key}
        <Panel panel={panel.shown} config={snapshot.config} {match} {offset} leaving={panel.leaving} ongone={panel.gone} />
      {/key}
    {/if}
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
