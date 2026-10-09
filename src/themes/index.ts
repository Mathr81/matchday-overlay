import type { ThemeId } from '../shared/types';
import ClairFreeBanner from './clair/FreeBanner.svelte';
import ClairMoment from './clair/Moment.svelte';
import ClairPanel from './clair/Panel.svelte';
import ClairScorebug from './clair/Scorebug.svelte';
import RegieFreeBanner from './regie/FreeBanner.svelte';
import RegieMoment from './regie/Moment.svelte';
import RegiePanel from './regie/Panel.svelte';
import RegieScorebug from './regie/Scorebug.svelte';
import TigreFreeBanner from './tigre/FreeBanner.svelte';
import TigreMoment from './tigre/Moment.svelte';
import TigrePanel from './tigre/Panel.svelte';
import TigreScorebug from './tigre/Scorebug.svelte';

/**
 * Ce qu'un thème fournit à l'overlay. Chaque composant joue lui-même son entrée et sa sortie ;
 * il ne reçoit que des données prêtes à afficher et ne contient aucune logique de match.
 * Le format vertical se lit dans le contexte Svelte « tall ».
 */
export interface Theme {
  Scorebug: typeof TigreScorebug;
  Moment: typeof TigreMoment;
  Panel: typeof TigrePanel;
  FreeBanner: typeof TigreFreeBanner;
}

export const themes: Record<ThemeId, Theme> = {
  tigre: { Scorebug: TigreScorebug, Moment: TigreMoment, Panel: TigrePanel, FreeBanner: TigreFreeBanner },
  clair: { Scorebug: ClairScorebug, Moment: ClairMoment, Panel: ClairPanel, FreeBanner: ClairFreeBanner },
  regie: { Scorebug: RegieScorebug, Moment: RegieMoment, Panel: RegiePanel, FreeBanner: RegieFreeBanner },
};
