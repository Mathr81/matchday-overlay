<script lang="ts">
  import gsap from 'gsap';
  import { onMount, untrack } from 'svelte';
  import { connect } from '../client/connection';
  import Overlay from '../overlay/Overlay.svelte';
  import { THEMES } from '../shared/types';
  import type { Config, Cue, Snapshot, ThemeId } from '../shared/types';
  import { themeNames } from '../themes/names';
  import { buildScene, SCENES, type SceneId } from './scenes';

  // Galerie : chaque élément de l'habillage avec des données inventées, sans toucher au match.
  // Elle reprend les équipes et les textes de la configuration ; le thème choisi ici ne change pas celui de l'antenne.
  const params = new URLSearchParams(location.search);
  const bare = params.has('bare');
  let config = $state<Config | null>(null);
  let theme = $state<ThemeId>((THEMES as readonly string[]).includes(params.get('theme') ?? '') ? (params.get('theme') as ThemeId) : 'tigre');
  let tall = $state(params.has('tall'));
  let scene = $state<SceneId>((params.get('scene') as SceneId) ?? 'score');
  let box = $state<HTMLElement>();
  let size = $state({ w: 0, h: 0 });

  let handlers: { onSnapshot(s: Snapshot, offset: number): void; onCue?(cue: Cue): void } | null = null;
  let rev = 0;

  /** Source de données de l'overlay : à la place du serveur, c'est la galerie qui envoie l'état. */
  const feed = (h: NonNullable<typeof handlers>) => {
    handlers = h;
    show(scene, false);
    return { close: () => (handlers = null) };
  };

  function show(id: SceneId, withCue = true) {
    scene = id;
    if (!config || !handlers) return;
    const built = buildScene(id, config);
    const snapshot = (match = built.match): Snapshot => ({ type: 'snapshot', rev: ++rev, serverNow: Date.now(), config: { ...config!, theme }, match, display: built.display, simulation: false });
    if (built.cue?.type === 'goal' && withCue) {
      // Comme le serveur : le signal part avant le nouvel état, pour que le score ne roule qu'au bon moment.
      const before = { ...built.match, score: { ...built.match.score, [built.cue.team]: built.match.score[built.cue.team] - 1 } };
      handlers.onSnapshot(snapshot(before), 0);
      handlers.onCue?.(built.cue);
      handlers.onSnapshot(snapshot(), 0);
      return;
    }
    handlers.onSnapshot(snapshot(), 0);
    if (built.cue && withCue) handlers.onCue?.(built.cue);
  }

  $effect(() => {
    theme;
    untrack(() => show(scene, false));
  });

  onMount(() => {
    const connection = connect('overlay', {
      onSnapshot: (s) => {
        if (config) return;
        config = s.config;
        if (!params.has('theme')) theme = s.config.theme;
        connection.close();
        // Avec ?scene=…, le signal part une fois l'overlay monté.
        setTimeout(() => {
          show(scene);
          // ?freeze=1.2 fige toutes les animations 1,2 s après le départ, pour examiner une image précise.
          if (params.has('freeze')) gsap.delayedCall(Number(params.get('freeze')), () => gsap.globalTimeline.pause());
        }, 300);
      },
    });
    const observer = new ResizeObserver(([entry]) => (size = { w: entry.contentRect.width, h: entry.contentRect.height }));
    if (box) observer.observe(box);
    return () => {
      connection.close();
      observer.disconnect();
    };
  });

  const W = $derived(tall ? 1080 : 1920);
  const H = $derived(tall ? 1920 : 1080);
  const scale = $derived(bare ? Number(params.get('zoom') ?? 1) : Math.min(size.w / W, size.h / H) || 0.1);
</script>

<main class:bare>
  {#if !bare}
    <aside>
      <h1>Galerie</h1>
      <p>Chaque élément de l'habillage, avec des données d'exemple. Rien n'est envoyé à l'antenne.</p>
      <div class="pick">
        {#each THEMES as t (t)}<button class:on={theme === t} onclick={() => (theme = t)}>{themeNames[t]}</button>{/each}
      </div>
      <div class="pick">
        <button class:on={!tall} onclick={() => (tall = false)}>16:9</button>
        <button class:on={tall} onclick={() => (tall = true)}>9:16</button>
      </div>
      {#each Object.entries(SCENES) as [group, scenes] (group)}
        <h2>{group}</h2>
        <div class="scenes">
          {#each Object.entries(scenes) as [id, label] (id)}
            <button class:on={scene === id} onclick={() => show(id as SceneId)}>{label}</button>
          {/each}
        </div>
      {/each}
    </aside>
  {/if}
  <section bind:this={box}>
    {#if config}
      {#key tall}
        <div class="frame" style:width="{W * scale}px" style:height="{H * scale}px">
          <div class="scaler" style:transform="scale({scale})" style:width="{W}px" style:height="{H}px">
            <Overlay {tall} {feed} fixed />
          </div>
        </div>
      {/key}
    {:else}
      <p class="wait">Connexion au serveur…</p>
    {/if}
  </section>
</main>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: #0e0e10;
    color: #edeae4;
    font-family: system-ui, sans-serif;
  }
  main {
    display: grid;
    grid-template-columns: 290px 1fr;
    height: 100vh;
  }
  main.bare {
    display: block;
  }
  aside {
    padding: 18px;
    overflow-y: auto;
    border-right: 1px solid #1f1f22;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 20px;
  }
  h2 {
    margin: 18px 0 8px;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #9b978f;
  }
  p {
    margin: 0 0 14px;
    font-size: 13px;
    color: #9b978f;
  }
  .pick {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .pick button {
    flex: 1;
  }
  .scenes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  button {
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 10px;
    border: 1px solid #2a2a2e;
    border-radius: 6px;
    background: #17171a;
    color: inherit;
    cursor: pointer;
  }
  button.on {
    background: #ef5407;
    border-color: #ef5407;
    color: #0a0a0a;
  }
  section {
    display: grid;
    place-items: center;
    padding: 18px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .bare section {
    padding: 0;
    place-items: start;
  }
  .frame {
    position: relative;
    overflow: hidden;
    border-radius: 6px;
    /* Faux terrain, pour juger l'habillage sur une image claire et chargée. */
    background:
      repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 8%, transparent 8% 16%),
      linear-gradient(#3d7a44, #2c5e35);
  }
  .bare .frame {
    border-radius: 0;
  }
  .scaler {
    position: relative;
    transform-origin: 0 0;
  }
  .wait {
    font-size: 15px;
  }
  @media (max-width: 800px) {
    main {
      grid-template-columns: 1fr;
      grid-template-rows: 46vh 1fr;
    }
    aside {
      order: 2;
      border-right: 0;
      border-top: 1px solid #1f1f22;
    }
  }
</style>
