import type { ThemeId } from '../shared/types';
import TigreFreeBanner from './tigre/FreeBanner.svelte';
import TigreMoment from './tigre/Moment.svelte';
import TigrePanel from './tigre/Panel.svelte';
import TigreScorebug from './tigre/Scorebug.svelte';

/**
 * Ce qu'un thème fournit à l'overlay. Chaque composant joue lui-même son entrée et sa sortie ;
 * il ne reçoit que des données prêtes à afficher et ne contient aucune logique de match.
 */
export interface Theme {
  Scorebug: typeof TigreScorebug;
  Moment: typeof TigreMoment;
  Panel: typeof TigrePanel;
  FreeBanner: typeof TigreFreeBanner;
}

export const themes: Record<ThemeId, Theme> = {
  tigre: { Scorebug: TigreScorebug, Moment: TigreMoment, Panel: TigrePanel, FreeBanner: TigreFreeBanner },
};
