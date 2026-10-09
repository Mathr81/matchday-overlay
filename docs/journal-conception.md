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

## Réalisation

Demande du 8 octobre : pas de plan d'implémentation détaillé ni de sous-agents, coder directement, étape par étape.

### Étape 1 — socle (faite le 8 octobre)

- Serveur Node (Fastify + WebSocket), journal `data/match.jsonl` écrit sur disque à chaque action, état recalculé à partir du journal, chrono sans tic-tac côté serveur.
- Overlay `/overlay/16x9` avec le score du thème Tigre : entrée et sortie animées, score qui roule, étiquette de temps additionnel.
- Contrôle minimal `/control` : coup d'envoi, pause, fin de période, buts, annulation du dernier but, temps additionnel, masquer le score, nouveau match.
- Vérifié : 19 tests automatiques ; mise à jour en direct de l'overlay ; serveur tué brutalement puis relancé, score et chrono retrouvés et overlay reconnecté tout seul.
- Pas encore vérifié : le rendu dans vMix et dans OBS (à faire sur le PC de régie).
- Reporté à l'étape 3 comme prévu : code PIN, effectifs, historique complet.
- Détail technique : TypeScript 6 plutôt que 7, l'outil de vérification Svelte ne gère pas encore la version 7 seule.

Retour du 8 octobre sur l'étape 1 : tout fonctionne dans vMix, fluide.

### Étape 2 — moments de match et simulation (faite le 8 octobre)

- Événements ajoutés au journal : but avec buteur, passeur et type (normal, penalty, contre son camp), but refusé, penalty annoncé et raté, cartons, remplacement, correction du chrono.
- Le deuxième jaune est détecté par le serveur ; un joueur expulsé ne peut plus recevoir de carton.
- Signaux d'animation envoyés aux overlays connectés, joués une seule fois, avec une file : un moment à la fois, et celui en cours écourte sa sortie si un autre attend.
- Le score est retenu pendant le plein écran d'un but et ne roule qu'à sa sortie.
- Thème Tigre : plein écran de but aux couleurs de l'équipe, bandeau (but, but refusé, penalty, penalty raté), carton, deuxième jaune qui se retourne en rouge, remplacement.
- Contrôle : choix du joueur dans une grille, type de but, cartons, remplacement, penalty, refuser le dernier but.
- Simulation : match scripté jusqu'à la fin du temps réglementaire (2 – 2), sur un journal à part.
- Effectifs d'exemple inventés dans la configuration par défaut : à remplacer par les vrais noms.
- Vérifié : 23 tests ; but, but adverse, deuxième jaune contrôlés par captures ; simulation complète sans erreur. Pas encore vérifié dans vMix.

Retour du 9 octobre sur l'étape 2 : tout fonctionne.

### Étape 3 — page de contrôle complète (faite le 9 octobre)

- Code PIN : tiré au hasard et écrit dans `data/config.json` au premier lancement, affiché dans la console. Il donne un jeton gardé sur le téléphone ; sans jeton valide, le serveur ferme la connexion de contrôle. Le code n'est jamais envoyé aux pages.
- Annulation rapide : barre de dix secondes après chaque action.
- Historique : chaque fait de match peut être corrigé (joueur, minute, équipe), refusé à l'antenne pour un but, ou supprimé. Une correction est une ligne de plus dans le journal, l'original n'est jamais réécrit.
- Corrections sans annonce : score + et −, réglage direct du chrono.
- Composition suivie d'après les titulaires et les remplacements : seuls les joueurs sur le terrain peuvent sortir, seuls ceux du banc peuvent entrer, un expulsé est grisé.
- Confirmation avant de terminer le match ; aperçu de l'antenne dans la page.
- Vérifié : 26 tests ; parcours complet joué dans un navigateur (mauvais code refusé, bon code accepté, but avec passeur, changement de buteur, remplacement puis annulation, deuxième jaune, joueur expulsé grisé, chrono réglé, score corrigé).
- Limite connue : le jeton dépend seulement du code PIN. C'est la protection basique demandée pour un réseau partagé, pas une sécurité forte.

Retour du 9 octobre sur l'étape 3 : tout fonctionne.

### Étape 4 — panneaux, bandeaux et stats (faite le 9 octobre)

- État d'affichage étendu : un panneau et un bandeau libre, gardés sur disque. Quand le contenu change, l'ancien joue sa sortie avant que le nouveau entre.
- Panneaux du thème Tigre : avant-match avec compte à rebours calé sur l'heure du serveur, composition (titulaires et remplaçants), résumé (score, buteurs, stats, homme du match), stats en direct, écran d'attente opaque à bandes défilantes.
- Bandeaux libres avec QR code généré dans l'overlay, sans Internet. Modèles dans la configuration.
- Stats : compteurs saisis (tirs, tirs cadrés, corners, fautes, hors-jeu) écrits dans le journal, cartons comptés automatiquement.
- Règles d'affichage : un panneau plein écran masque le score ; le bandeau libre s'efface pendant un moment ou derrière un panneau.
- Les animations suivent l'heure réelle même si l'affichage saccade (elles ne prennent plus de retard). Découvert parce que le navigateur de test tournait à 2 images par seconde.
- Simulation complétée : avant-match, compositions, bandeau, stats, résumé de mi-temps et de fin de match.
- Vérifié : 28 tests ; chaque panneau contrôlé par capture ; simulation complète sans erreur. Corrigé en route : nom d'équipe qui débordait sur l'avant-match, ligne de score trop large sur le résumé.
- Pas encore vérifié dans vMix. Les captures montrent l'état final de chaque panneau, pas la fluidité des entrées et sorties.
- Limite connue : le panneau et le bandeau sont communs au vrai match et à la simulation.

9 octobre : étape 4 acceptée sans test (pas d'ordinateur sous la main), à revoir dans vMix.

### Étape 5 — prolongations et tirs au but (faite le 9 octobre)

- Format du match étendu : prolongations (deux périodes, durée propre) et séance de tirs au but (nombre de tirs réglable), chacune activable. Les deux sont actives par défaut.
- À la fin d'une période, l'état calcule ce qui reste possible ; le contrôle ne propose que ça. Un nul peut toujours être terminé à la main.
- Séance de tirs au but dans `src/shared/shootout.ts` : fin dès qu'une équipe ne peut plus être rattrapée, mort subite après une série à égalité, ordre des tireurs. Chaque tir est une ligne du journal, donc annulable ; annuler le tir décisif rouvre la séance.
- Thème Tigre : panneau de la séance (cases tamponnées, case du prochain tireur qui clignote, bascule sur « Mort subite », ligne perdante estompée), score de la séance à côté du score du match, plein écran « Victoire ».
- Le vainqueur est annoncé sur commande, jamais automatiquement.
- Simulation prolongée jusqu'au bout : prolongations, 4 – 4 après cinq tirs, mort subite, victoire, résumé.
- Vérifié : 36 tests, dont huit sur les prolongations et la séance ; séance et annonce contrôlées par capture ; simulation complète sans erreur.
- Pas encore vérifié dans vMix, comme l'étape 4.
- Pas fait : le nom du tireur. Le serveur l'accepte, mais le contrôle ne le demande pas et le panneau ne l'affiche pas.

9 octobre : étape 5 enchaînée sans test de l'utilisateur, à revoir dans vMix avec l'étape 4.

### Étape 6, première moitié — admin et changement de thème (faite le 9 octobre)

- Page `/admin` protégée par le PIN : événement, équipes, logos, joueurs, format, bandeaux, code PIN. Enregistrement appliqué en direct à tous les écrans.
- Le serveur vérifie tout ce qu'il reçoit et répond par un message qui nomme le champ fautif. Écriture du fichier par renommage, pour ne jamais laisser un fichier à moitié écrit.
- Logos envoyés : nommés d'après leur contenu, rangés dans `data/uploads/`, types d'image seulement, 2 Mo au plus.
- Changer le PIN ferme les connexions de contrôle et rend l'ancien jeton inutilisable.
- Thèmes : registre `src/themes/index.ts` qui fixe ce qu'un thème fournit (score, moments, panneaux, bandeau libre). L'overlay sait changer de thème en direct : tout sort, bascule, tout rentre. Un seul thème existe pour l'instant, donc cette bascule n'a pas encore pu être essayée pour de vrai.
- Vérifié : 42 tests ; parcours de l'admin joué dans un navigateur (modification, couleur invalide refusée avec son message, ajout d'un joueur, enregistrement relu côté serveur).
- Pas vérifié : l'envoi d'un vrai fichier image depuis le sélecteur de fichiers (l'API est testée, pas le bouton).
- Reste pour finir l'étape 6 : les thèmes Régie et Clair, chacun avec une étude de mouvement à valider avant d'être construit.

9 octobre : toujours pas de test possible côté utilisateur ; les thèmes Régie et Clair attendent qu'il puisse juger des maquettes. Étape 8 faite avant l'étape 7.

### Étape 8 — vMix et Companion (faite le 9 octobre)

- Réglages privés (PIN, clé Companion, vMix) séparés de la configuration publique : ils ne sont jamais envoyés aux overlays.
- Le magasin signale les événements de match (but, but de chaque équipe, but refusé, penalty, cartons, remplacement, début et fin de période, tirs au but, fin du match, annonce du vainqueur). Rien pour une correction sans annonce, une commande reçue deux fois, ou pendant une simulation.
- `src/server/vmix.ts` : table de déclencheurs, interrupteur général, délai par ligne, appel de test, journal des cinquante derniers appels, vérification de la connexion. Un échec est noté et n'a aucun effet sur l'habillage.
- Admin : sections vMix (déclencheurs, test, journal) et Companion (clé, adresses prêtes à copier).
- Adresses `/api/do/…` protégées par la clé : score, bandeaux, panneaux, thème. Pas d'actions de match.
- Valeurs par défaut prudentes : rien d'actif, exemples qui ne changent pas de plan.
- Vérifié : 50 tests ; essai de bout en bout avec un faux vMix local (connexion, appel de test, déclenchement réel sur un but).
- Constat pendant l'essai : un vrai vMix 29 tournait sur ce PC et a répondu à la vérification de connexion (lecture seule). Aucune fonction ne lui a été envoyée : les appels de test sont partis vers le faux vMix.
- Pas vérifié : l'effet réel des fonctions dans vMix. Les noms `OverlayInput2In` et `ReplayMarkInOut` des exemples viennent de ma connaissance de l'API vMix et sont à confirmer dans vMix avec le bouton « Tester ».

### Étape 7 — Format vertical 9:16 (thème Tigre, faite le 9 octobre)

Faite sans l'utilisateur, qui n'a pas accès au PC : à revoir avec lui.

- `/overlay/9x16` : scène de 1080×1920, même état et mêmes signaux que le 16:9. La même page sert les deux formats.
- Marges de sécurité réglables dans l'admin (haut 230 px, bas 520 px par défaut) : rien ne s'affiche dans la zone prise par l'interface de TikTok. Valeurs choisies d'après ma connaissance de l'interface du live TikTok, à ajuster sur un vrai téléphone.
- Chaque élément du thème Tigre a une mise en page verticale, pas une réduction du 16:9 :
  - score centré en haut, chrono et période sur une deuxième ligne ;
  - bandeaux en bas à gauche, l'étiquette au-dessus du nom, la taille du nom ajustée à sa longueur ;
  - plein écran « But » et « Victoire » : bande plus inclinée, blason à cheval sur son bord ;
  - avant-match : les deux équipes l'une sous l'autre, chacune venant de son bord ;
  - compositions en une colonne, résumé empilé (équipe, score, équipe), tirs au but avec les sigles et des cases qui rétrécissent en mort subite.
- Nouvelle page `/galerie` : chaque élément de l'habillage avec des données inventées, dans les deux formats et pour chaque thème, sans toucher au match ni à l'antenne. Elle sert à juger un thème et m'a servi à vérifier le vertical par captures.
- Corrigé au passage : sur l'avant-match en 16:9, le nom de l'équipe 1 passait sous le « vs » (largeur des deux moitiés mal comptée).
- Vérifié : 50 tests, captures de tous les éléments en 9:16 et d'un échantillon en 16:9.
- Pas vérifié : le rendu dans vMix ou OBS, et la position réelle de l'interface de TikTok.
- Toujours ouvert : comment produire le flux vertical en même temps que le 16:9 (voir le README).
