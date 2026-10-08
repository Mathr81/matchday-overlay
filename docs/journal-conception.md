# Journal de conception — matchday-overlay

Trace de tout ce qui est demandé, proposé et décidé pendant la conception. La spec finale sera écrite dans `docs/superpowers/specs/` une fois le design validé ; ce journal garde l'historique et les raisons.

## Le besoin (résumé du cahier des charges, 8 octobre 2026)

Habillage de score de niveau TV pour le live YouTube (et TikTok) du match de foot profs contre élèves organisé avec le BDT, réutilisable pour d'autres sports.

- Régie : 4 à 6 iPhones en SRT, drone DJI Mini 3 en RTMP via MediaMTX, PC Windows (Legion 5, i5-11400H, RTX 3060) avec vMix, OBS en secours, WiFi dédié avec Internet.
- Priorités : qualité visuelle et animations, plusieurs thèmes interchangeables en direct, tout configurable sans code, page de contrôle mobile à une main avec protection et correction rapide, aucune perte de score ou de chrono au rechargement ou au redémarrage.
- Scénarios : avant-match et compositions, buts (buteur, passeur, csc, refusé), penalty, cartons, remplacements, arrêts de jeu et temps additionnel, mi-temps, fin de match avec résumé, prolongations, séance de tirs au but complète, bandeaux libres, masquage du score.
- Aussi : déclenchements vMix, version 9:16 pensée pour le vertical, mode simulation d'un match complet, README.
- Méthode demandée : architecture + recommandation vMix + maquettes d'abord, validation, puis étapes testables.

## Réponses obtenues

| Question | Réponse |
|---|---|
| Échéance | Plus de 6 semaines : périmètre complet, temps pour le polish |
| Édition vMix | Essai 60 jours ou inconnue : le replay doit rester optionnel |
| Qui pilote | Pas encore décidé, seul ou à deux : tous les appareils connectés sont synchronisés, sans rôles imposés |

## Logos et identité

Copiés depuis `OneDrive/Terminale/BDT/Logos` vers `assets/logos/`.

- Élèves : blason tigre « T Barral 2027 », blanc sur orange `#EF5407`. `logo-no-background.svg` (blanc, fond transparent) est la version à utiliser dans les overlays.
- Profs : logo de l'établissement (trois arbres), bleu pétrole `#1E3F4E` et gris-bleu `#A9B8BF`. Il est sombre, donc toujours posé sur une pastille claire.

## Directions visuelles proposées

Maquette animée : `docs/maquettes/01-directions-visuelles.html` (s'ouvre directement dans un navigateur).

- **A — Régie** : barre sombre compacte en haut à gauche, liseré de couleur par équipe, Barlow Condensed, révélations par volet.
- **B — Tigre** : blocs inclinés orange et noir, rayures, Anton, entrées avec rebond.
- **C — Clair** : pastille blanche centrée, logos ronds, Sora, apparitions douces avec flou.

Retour du 8 octobre : les trois plaisent et seront des thèmes, **B (Tigre) est le préféré**, mais le niveau de la première maquette est jugé trop générique (« AI slop »). Exigence : un vrai travail de motion design.

### Deuxième passe : étude de mouvement du thème Tigre

Maquette : `docs/maquettes/02-tigre-mouvement.html`. Vraie scène 1920×1080 pilotée par des timelines GSAP, avec boutons par séquence, enchaînement complet et ralenti.

- **Motif** : le coup de griffe, tiré du blason. Trois traits inclinés à 14°, repris partout (fin de bandeau, séparateur de score, cases de tirs au but, bandes du plein écran).
- **Typo** : Anybody, police à largeur variable. Les mots s'étirent de très étroit à très large en arrivant.
- **Palette** : orange `#EF5407`, noir `#0A0A0A`, blanc cassé `#F3EEE4`, pétrole `#1E3F4E` pour les profs.
- **Séquences maquettées** : entrée et sortie du score, but (plein écran puis bandeau, score qui roule), carton jaune, deuxième jaune qui se retourne en rouge, remplacement (sortant barré), séance de tirs au but avec mort subite et annonce du vainqueur.
- **Hiérarchie** : seuls le but et la victoire prennent le plein écran ; cartons et remplacements restent en bas à gauche.

Les thèmes A et C seront retravaillés au même niveau une fois celui-ci validé.

Choix : **deuxième passe validée le 8 octobre.** Spec écrite dans `docs/superpowers/specs/2026-10-08-matchday-overlay-design.md`.

## Architecture proposée

Choix : **validée le 8 octobre.**

- **Un seul programme Node.js** (TypeScript) sur le PC de régie : il sert les pages et tient l'état du match. Pas de base de données, pas de cloud.
- **Pages** construites avec Svelte 5 et Vite ; animations avec GSAP (timelines), polices embarquées localement pour ne pas dépendre d'Internet.
  - `/overlay/16x9` et `/overlay/9x16` : fond transparent, à charger dans vMix ou OBS.
  - `/control` : page mobile de pilotage.
  - `/admin` : configuration (équipes, joueurs, couleurs, logos, format de match, thème, déclencheurs vMix).
  - `/simulation` : rejoue un match complet jusqu'aux tirs au but.
- **État = journal d'événements.** Le match est une liste d'événements horodatés (coup d'envoi, but, carton…) ; le score et les stats sont recalculés à partir de cette liste. Corriger une erreur revient à annuler ou modifier un événement, et tout se recalcule. Chaque événement est écrit sur disque immédiatement.
- **Chrono sans tic-tac côté serveur.** On enregistre « démarré à telle heure, avec tant de temps déjà écoulé » ; chaque écran calcule l'affichage à partir de l'heure du serveur. Un rechargement ou un redémarrage retrouve donc le chrono exact.
- **Temps réel par WebSocket.** À chaque changement le serveur renvoie l'état complet (il est petit) avec un numéro de révision ; reconnexion automatique ; les commandes du téléphone portent un identifiant pour qu'un double envoi ne compte pas deux buts.
- **Affichage en deux couches.** Les éléments permanents (score, chrono) et une file de « moments » (but, carton, remplacement…) qui s'enchaînent sans se chevaucher.
- **Thèmes.** Un thème est un dossier de composants plus des réglages ; couleurs, logos, polices et textes viennent de la configuration. Changement en direct avec sortie puis entrée animées.
- **Autres sports.** Un « profil de sport » décrit périodes, sens du chrono, types d'événements et valeur des points. Seul le foot est construit maintenant.
- **Protection.** Code PIN pour le contrôle et l'admin ; les overlays sont en lecture seule.

## vMix et Companion

Recommandation : **combinaison, avec l'intégration directe comme base.** Choix : **validée le 8 octobre.**

- L'app appelle elle-même l'API HTTP de vMix (même PC) quand un événement de match arrive. Une table de déclencheurs configurable associe un événement à des fonctions vMix, chaque ligne activable séparément, avec un interrupteur général et un bouton de test. Un échec vMix n'empêche jamais l'overlay de s'afficher.
- Companion reste facultatif, pour les boutons manuels de la régie (plans, replay) : son module vMix le fait déjà très bien, inutile de le refaire. L'app expose aussi des adresses HTTP simples pour que Companion ou un Stream Deck puisse lancer des actions de l'app.
- Pourquoi pas Companion seul : il ne sait pas qu'un but vient d'être saisi sur le téléphone, il faudrait appuyer une deuxième fois en régie, et c'est un programme de plus à surveiller en direct.
- Prudence : par défaut seuls les stingers et effets sont automatisés, pas les changements de plan à l'antenne. Le replay dépend de l'édition vMix (4K ou Pro) et reste optionnel.

## Situations supplémentaires proposées

Compte à rebours avant le coup d'envoi, pause fraîcheur, but en cours de vérification, homme du match, stats en direct (tirs, corners, fautes), écran « de retour dans un instant », bandeau avec QR code (cagnotte, réseaux du BDT), rappel du score à la reprise.

## Points ouverts

- Comment produire le flux vertical TikTok en même temps que le 16:9 (vMix n'a qu'un format de sortie par instance) : à étudier avant l'étape 9:16.
- L'essai vMix de 60 jours doit couvrir le jour du match.
