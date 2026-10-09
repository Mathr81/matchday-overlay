<script lang="ts">
  import type { Config, Cue, TeamId } from '../../shared/types';
  import Banner from './Banner.svelte';
  import CardMoment from './CardMoment.svelte';
  import { ALERT } from './motion';
  import Strap from './Strap.svelte';
  import SubMoment from './SubMoment.svelte';

  // Joue l'animation d'un signal, puis appelle `ondone`. `onscore` : moment où le score peut rouler.
  let { cue, config, hurry, onscore, ondone }: { cue: Cue; config: Config; hurry: boolean; onscore: () => void; ondone: () => void } = $props();

  const team = $derived(config.teams[cue.team]);
  // Sur la ligne du score final : les noms s'ils sont courts, sinon les sigles.
  const short = $derived(config.teams.home.name.length + config.teams.away.name.length <= 20);
  const label = (id: TeamId) => (short ? config.teams[id].name : config.teams[id].code);
  let strap = $state(true);
  let banner = $state(false);

  const goalMeta = (c: Extract<Cue, { type: 'goal' }>) =>
    c.kind === 'own' ? { label: 'Contre son camp', value: '' } : c.assist ? { label: 'Passe décisive', value: c.assist.name } : c.kind === 'penalty' ? { label: 'Sur penalty', value: '' } : { label: '', value: '' };
</script>

{#if cue.type === 'goal'}
  {@const meta = goalMeta(cue)}
  {#if strap}
    <Strap
      word="But"
      {team}
      kicker={cue.minute}
      line={team.name}
      onexit={() => {
        onscore();
        banner = true;
      }}
      ondone={() => (strap = false)}
    />
  {/if}
  {#if banner}
    <Banner tag="But" sub={cue.minute} number={cue.scorer?.number ?? null} name={cue.scorer?.name ?? team.name} metaLabel={meta.label} metaValue={meta.value} color={team.color} {team} {hurry} {ondone} />
  {/if}
{:else if cue.type === 'goal_disallowed'}
  <Banner tag="But refusé" sub={cue.minute} number={cue.scorer?.number ?? null} name={cue.scorer?.name ?? team.name} color={ALERT} {team} {hurry} {ondone} />
{:else if cue.type === 'penalty'}
  <Banner tag="Penalty" sub={cue.minute} name={team.name} color={team.color} {team} hold={3} {hurry} {ondone} />
{:else if cue.type === 'penalty_missed'}
  <Banner tag="Penalty raté" sub={cue.minute} number={cue.player?.number ?? null} name={cue.player?.name ?? team.name} color={ALERT} {team} {hurry} {ondone} />
{:else if cue.type === 'card'}
  <CardMoment color={cue.color} player={cue.player} {team} minute={cue.minute} {hurry} {ondone} />
{:else if cue.type === 'winner'}
  <Strap
    word="Victoire"
    {team}
    kicker={team.name}
    line="{label('home')} {cue.score.home} – {cue.score.away} {label('away')}"
    note={cue.shootout ? `${cue.shootout.home} – ${cue.shootout.away} aux tirs au but` : ''}
    center
    hold={3.6}
    {ondone}
  />
{:else if cue.type === 'substitution'}
  <SubMoment playerIn={cue.in} playerOut={cue.out} {team} minute={cue.minute} {hurry} {ondone} />
{/if}
