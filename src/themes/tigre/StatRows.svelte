<script lang="ts">
  import type { StatRow } from '../../shared/summary';
  import type { Config } from '../../shared/types';
  import { onDark } from './motion';

  // Lignes de stats : valeur de chaque côté, barre proportionnelle vers le centre.
  let { rows, config }: { rows: StatRow[]; config: Config } = $props();
  const share = (a: number, b: number) => (a + b === 0 ? 0 : a / Math.max(a, b));
</script>

<div class="stats" style:--home={onDark(config.teams.home.color)} style:--away={onDark(config.teams.away.color)}>
  {#each rows as r (r.label)}
    <div class="stat para hatch">
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
    align-items: center;
    gap: 5px;
  }
  .stat {
    height: 46px;
    --s: 11.5px;
    width: 1000px;
    padding: 0 40px;
    display: grid;
    grid-template-columns: 60px 1fr 260px 1fr 60px;
    align-items: center;
    gap: 18px;
    background-color: rgba(10, 10, 10, 0.96);
    font-size: 30px;
  }
  b {
    font-weight: 900;
    text-align: center;
  }
  .label {
    text-align: center;
    font-size: 19px;
    font-weight: 800;
    letter-spacing: 0.13em;
    --wd: 88;
    font-variation-settings: 'wdth' 88;
    opacity: 0.85;
  }
  .bar {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    transform: skewX(-14deg);
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
</style>
