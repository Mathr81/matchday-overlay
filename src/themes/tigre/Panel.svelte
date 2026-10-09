<script lang="ts">
  import type { Config, MatchState, Panel } from '../../shared/types';
  import HoldingPanel from './HoldingPanel.svelte';
  import LineupPanel from './LineupPanel.svelte';
  import PrematchPanel from './PrematchPanel.svelte';
  import ShootoutPanel from './ShootoutPanel.svelte';
  import StatsPanel from './StatsPanel.svelte';
  import SummaryPanel from './SummaryPanel.svelte';

  // Affiche un panneau. Quand `leaving` passe à vrai, il joue sa sortie puis appelle `ongone`.
  let { panel, config, match, offset, leaving, ongone }: { panel: Panel; config: Config; match: MatchState; offset: number; leaving: boolean; ongone: () => void } =
    $props();
</script>

{#if panel.type === 'prematch'}
  <PrematchPanel {config} kickoffAt={panel.kickoffAt} {offset} {leaving} {ongone} />
{:else if panel.type === 'lineup'}
  <LineupPanel team={config.teams[panel.team]} {leaving} {ongone} />
{:else if panel.type === 'summary'}
  <SummaryPanel {config} {match} motm={panel.motm} {leaving} {ongone} />
{:else if panel.type === 'stats'}
  <StatsPanel {config} {match} {leaving} {ongone} />
{:else if panel.type === 'shootout'}
  <ShootoutPanel {config} shootout={match.shootout} {leaving} {ongone} />
{:else if panel.type === 'holding'}
  <HoldingPanel {config} {leaving} {ongone} />
{/if}
