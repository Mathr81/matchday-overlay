<script lang="ts">
  import { onMount, setContext, untrack } from 'svelte';
  import { connect } from '../client/connection';
  import type { Banner, Cue, Panel as PanelData, Snapshot, TeamId, ThemeId } from '../shared/types';
  import { themes } from '../themes';
  import { Slot } from './slot.svelte';

  // `tall` : format vertical 1080×1920. Les thèmes le lisent dans le contexte pour recomposer leurs éléments.
  // `feed` remplace la connexion au serveur (galerie) ; `fixed` laisse la mise à l'échelle à la page qui l'accueille.
  type Feed = (handlers: { onSnapshot(s: Snapshot, offset: number): void; onCue(cue: Cue): void }) => { close(): void };
  let { tall = false, feed, fixed = false }: { tall?: boolean; feed?: Feed; fixed?: boolean } = $props();
  setContext('tall', untrack(() => tall));
  const W = $derived(tall ? 1080 : 1920);
  const H = $derived(tall ? 1920 : 1080);

  /** Temps laissé aux éléments pour sortir avant de changer de thème. */
  const THEME_EXIT_MS = 900;

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

  // Changement de thème en direct : tout sort avec l'ancien thème, puis tout rentre avec le nouveau.
  let themeId = $state<ThemeId | null>(null);
  let switching = $state(false);
  const theme = $derived(themeId ? themes[themeId] : null);

  $effect(() => {
    const want = snapshot?.config.theme;
    if (!want || want === untrack(() => themeId) || untrack(() => switching)) return;
    if (untrack(() => themeId) === null) {
      themeId = want;
      return;
    }
    switching = true;
    setTimeout(() => {
      themeId = snapshot?.config.theme ?? want;
      switching = false;
    }, THEME_EXIT_MS);
  });

  const match = $derived(snapshot && heldScore ? { ...snapshot.match, score: heldScore } : snapshot?.match);
  // Un panneau plein écran prend la place du score ; les stats et les tirs au but le laissent visible.
  const covering = $derived(!!snapshot?.display.panel && snapshot.display.panel.type !== 'stats' && snapshot.display.panel.type !== 'shootout');

  $effect(() => {
    const want = switching ? null : (snapshot?.display.panel ?? null);
    untrack(() => panel.set(want));
  });
  // Le bandeau libre partage l'emplacement des moments : il s'efface pendant qu'un moment joue, ou derrière un panneau.
  $effect(() => {
    const want = switching || current || snapshot?.display.panel ? null : (snapshot?.display.banner ?? null);
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
    const handlers = {
      onSnapshot: (s: Snapshot, o: number) => {
        snapshot = s;
        offset = o;
      },
      onCue,
    };
    const connection = feed ? feed(handlers) : connect('overlay', handlers);
    // La scène a une taille fixe (1920×1080, ou 1080×1920 en vertical) ; elle est réduite pour tenir dans une fenêtre plus petite.
    const fit = () => (scale = fixed ? 1 : Math.min(innerWidth / W, innerHeight / H));
    fit();
    addEventListener('resize', fit);
    return () => {
      connection.close();
      removeEventListener('resize', fit);
    };
  });
</script>

<div
  class="stage"
  class:tall
  style:width="{W}px"
  style:height="{H}px"
  style:transform="scale({scale})"
  style:--safe-top="{snapshot?.config.vertical.top ?? 230}px"
  style:--safe-bottom="{snapshot?.config.vertical.bottom ?? 520}px"
>
  {#if snapshot && match && theme}
    {#key themeId}
      <theme.Scorebug config={snapshot.config} {match} visible={snapshot.display.scoreVisible && !covering && !switching} {offset} />
      {#if banner.shown}
        {#key banner.key}
          <theme.FreeBanner banner={banner.shown} leaving={banner.leaving} ongone={banner.gone} />
        {/key}
      {/if}
      {#if panel.shown}
        {#key panel.key}
          <theme.Panel panel={panel.shown} config={snapshot.config} {match} {offset} leaving={panel.leaving} ongone={panel.gone} />
        {/key}
      {/if}
      {#if current}
        {#key current.id}
          <theme.Moment cue={current} config={snapshot.config} hurry={queue.length > 0} onscore={() => (heldScore = null)} ondone={done} />
        {/key}
      {/if}
    {/key}
  {/if}
</div>

<style>
  .stage {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    overflow: hidden;
  }
</style>
