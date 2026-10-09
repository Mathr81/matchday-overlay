<script lang="ts">
  import type { StatRow } from '../../shared/summary';
  import type { Config } from '../../shared/types';
  import { onDark } from './motion';

  // Lignes de stats : valeur de chaque côté, barre fine proportionnelle vers le centre.
  let { rows, config }: { rows: StatRow[]; config: Config } = $props();
  const share = (a: number, b: number) => (a + b === 0 ? 0 : a / Math.max(a, b));
</script>

<div class="stats sheet" style:--home={onDark(config.teams.home.color)} style:--away={onDark(config.teams.away.color)}>
  {#each rows as r (r.label)}
    <div class="stat">
      <span class="up"><b class="rise mono">{r.home}</b></span>
      <span class="bar left"><i style:transform="scaleX({share(r.home, r.away)})"></i></span>
      <span class="up"><span class="rise lab">{r.label}</span></span>
      <span class="bar right"><i style:transform="scaleX({share(r.away, r.home)})"></i></span>
      <span class="up"><b class="rise mono">{r.away}</b></span>
    </div>
  {/each}
</div>

<style>
  .stats {
    padding: 6px 36px;
  }
  .stat {
    display: grid;
    grid-template-columns: 56px 1fr 240px 1fr 56px;
    align-items: center;
    gap: 22px;
    height: 44px;
    font-size: 26px;
    text-align: center;
  }
  .stat + .stat {
    border-top: 1px solid var(--hair);
  }
  .lab {
    font-size: 14px;
    color: #c9ced6;
  }
  .bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
  }
  .bar i {
    display: block;
    height: 100%;
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .left i {
    background: var(--home);
    transform-origin: 100% 50%;
  }
  .right i {
    background: var(--away);
    transform-origin: 0 50%;
  }
  :global(.tall) .stats {
    padding: 6px 28px;
  }
  :global(.tall) .stat {
    grid-template-columns: 46px 1fr 200px 1fr 46px;
    gap: 16px;
  }
</style>
