<script lang="ts">
  import type { StatRow } from '../../shared/summary';
  import type { Config } from '../../shared/types';
  import { onLight } from './motion';

  // Lignes de stats : valeur de chaque côté, barre arrondie proportionnelle vers le centre.
  let { rows, config }: { rows: StatRow[]; config: Config } = $props();
  const share = (a: number, b: number) => (a + b === 0 ? 0 : a / Math.max(a, b));
</script>

<div class="stats" style:--home={onLight(config.teams.home.color)} style:--away={onLight(config.teams.away.color)}>
  {#each rows as r (r.label)}
    <div class="stat tx">
      <b>{r.home}</b>
      <span class="bar left"><i style:transform="scaleX({share(r.home, r.away)})"></i></span>
      <span class="label">{r.label}</span>
      <span class="bar right"><i style:transform="scaleX({share(r.away, r.home)})"></i></span>
      <b>{r.away}</b>
    </div>
  {/each}
</div>

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }
  .stat {
    display: grid;
    grid-template-columns: 52px 1fr 230px 1fr 52px;
    align-items: center;
    gap: 20px;
    height: 44px;
    font-size: 27px;
    text-align: center;
  }
  b {
    font-weight: 800;
  }
  .label {
    font-size: 20px;
    font-weight: 600;
    color: var(--soft);
  }
  .bar {
    height: 12px;
    border-radius: 999px;
    background: var(--fog);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    border-radius: 999px;
    transition: transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .left i {
    background: var(--home);
    transform-origin: 100% 50%;
  }
  .right i {
    background: var(--away);
    transform-origin: 0 50%;
  }
  :global(.tall) .stat {
    grid-template-columns: 44px 1fr 190px 1fr 44px;
    gap: 14px;
  }
  :global(.tall) .label {
    font-size: 18px;
  }
</style>
