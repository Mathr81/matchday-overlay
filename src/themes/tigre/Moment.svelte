<script lang="ts">
  import type { Config, Cue } from '../../shared/types';
  import Banner from './Banner.svelte';
  import CardMoment from './CardMoment.svelte';
  import { ALERT } from './motion';
  import SubMoment from './SubMoment.svelte';
  import Takeover from './Takeover.svelte';

  // Joue l'animation d'un signal, puis appelle `ondone`. `onscore` : moment où le score peut rouler.
  let { cue, config, hurry, onscore, ondone }: { cue: Cue; config: Config; hurry: boolean; onscore: () => void; ondone: () => void } = $props();

  const team = $derived(config.teams[cue.team]);
  let takeover = $state(true);
  let banner = $state(false);

  const goalMeta = (c: Extract<Cue, { type: 'goal' }>) =>
    c.kind === 'own' ? { label: 'Contre son camp', value: '' } : c.assist ? { label: 'Passe décisive', value: c.assist.name } : c.kind === 'penalty' ? { label: 'Sur penalty', value: '' } : { label: '', value: '' };
</script>

{#if cue.type === 'goal'}
  {@const meta = goalMeta(cue)}
  {#if takeover}
    <Takeover
      word="But"
      {team}
      marquee="But · {team.name} · {cue.minute}"
      onexit={() => {
        onscore();
        banner = true;
      }}
      ondone={() => (takeover = false)}
    />
  {/if}
  {#if banner}
    <Banner tag="But" sub="{cue.minute} · {team.name}" number={cue.scorer?.number ?? null} name={cue.scorer?.name ?? team.name} metaLabel={meta.label} metaValue={meta.value} color={team.color} {hurry} {ondone} />
  {/if}
{:else if cue.type === 'goal_disallowed'}
  <Banner tag="But refusé" sub="{cue.minute} · {team.name}" number={cue.scorer?.number ?? null} name={cue.scorer?.name ?? team.name} color={ALERT} {hurry} {ondone} />
{:else if cue.type === 'penalty'}
  <Banner tag="Penalty" sub={cue.minute} name={team.name} color={team.color} hold={3} {hurry} {ondone} />
{:else if cue.type === 'penalty_missed'}
  <Banner tag="Penalty raté" sub="{cue.minute} · {team.name}" number={cue.player?.number ?? null} name={cue.player?.name ?? team.name} color={ALERT} {hurry} {ondone} />
{:else if cue.type === 'card'}
  <CardMoment color={cue.color} player={cue.player} {team} minute={cue.minute} {hurry} {ondone} />
{:else if cue.type === 'substitution'}
  <SubMoment playerIn={cue.in} playerOut={cue.out} {team} minute={cue.minute} {hurry} {ondone} />
{/if}
