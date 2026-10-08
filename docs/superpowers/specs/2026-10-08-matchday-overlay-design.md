# matchday-overlay — spécification de conception

Date : 8 octobre 2026. Historique des échanges et des raisons : `docs/journal-conception.md`. Maquettes : `docs/maquettes/`.

## 1. Objectif

Un habillage de score de niveau TV pour le live du match de foot profs contre élèves (YouTube en 16:9, TikTok en 9:16), piloté depuis un téléphone au bord du terrain, affiché dans vMix (OBS en secours), réutilisable pour d'autres matchs et d'autres sports.

Critères de réussite :

- les animations tournent sans saccade dans l'entrée navigateur de vMix et la source navigateur d'OBS, en 1080p ;
- recharger un overlay ou redémarrer le serveur ne perd ni le score, ni le chrono, ni ce qui est affiché ;
- une personne seule peut saisir un but avec son buteur en moins de cinq secondes, d'une main, et annuler une erreur en un appui ;
- tout ce qui est texte, couleur, logo, joueur, durée ou format se règle depuis une page, sans toucher au code ;
- un match complet, tirs au but compris, peut être rejoué en simulation sans être sur le terrain.

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Échéance | Plus de six semaines : périmètre complet |
| Pilotage | Un ou deux appareils, tous synchronisés, sans rôles imposés |
| Architecture | Un seul programme Node.js sur le PC de régie, état en journal d'événements, WebSocket |
| vMix | Intégration directe dans l'app pour les automatismes ; Companion facultatif pour les boutons manuels |
| Replay vMix | Optionnel (dépend de l'édition) |
| Thèmes | Tigre (principal, maquette validée), Régie et Clair (à retravailler au même niveau) |

## 3. Architecture

### Stack

- Node.js 24, TypeScript partout, gestionnaire de paquets pnpm.
- Serveur : Fastify (HTTP et fichiers statiques) et `ws` (WebSocket).
- Pages : Svelte 5 et Vite. Animations : GSAP (timelines). Polices embarquées dans le projet, aucun appel à Internet pendant le live.
- Tests : Vitest pour la logique, Playwright pour les pages.

### Structure

```
src/
  shared/     types, profil de sport, réducteur (événements → état), chrono, tirs au but
  server/     HTTP, WebSocket, persistance, authentification, vMix
  overlay/    moteur d'affichage (couches, file de moments), entrées 16x9 et 9x16
  themes/     tigre/, regie/, clair/ — un dossier par thème
  control/    page de pilotage mobile
  admin/      page de configuration
  simulation/ scénario de match rejoué
data/         journal du match, configuration, logos importés (hors git)
assets/       logos et polices fournis
docs/
```

`shared` ne dépend de rien d'autre et contient toute la logique de match : c'est ce qui est testé le plus.

### Pages servies

| Adresse | Rôle | Accès |
|---|---|---|
| `/overlay/16x9` | Habillage 1920×1080, fond transparent | Libre, lecture seule |
| `/overlay/9x16` | Habillage 1080×1920, fond transparent | Libre, lecture seule |
| `/control` | Pilotage mobile | Code PIN |
| `/admin` | Configuration | Code PIN |
| `/simulation` | Rejoue un match complet | Code PIN |

Port par défaut 4455, modifiable. Au démarrage, le serveur affiche dans la console les adresses à utiliser et un QR code pour le téléphone.

## 4. Modèle de l'état

Trois choses distinctes, toutes persistées dans `data/`.

**La configuration** (`config.json`) : équipes (nom, sigle, couleurs, logo), effectifs (numéro, nom, titulaire ou remplaçant), format du match, thème actif, textes, déclencheurs vMix, code PIN.

**Le journal du match** (`match.jsonl`) : une ligne par événement, ajoutée et synchronisée sur disque avant d'être confirmée au téléphone. Chaque événement porte un identifiant, l'heure du serveur, la minute de jeu, et un marqueur « annulé » éventuel. Le score, les cartons, les stats et la séance de tirs au but sont **recalculés** à partir du journal par un réducteur pur. Corriger, c'est annuler ou modifier un événement.

**L'affichage** (`display.json`) : ce qui est à l'antenne en permanence (score visible ou non, panneau plein écran en cours, bandeau libre affiché, panneau des tirs au but). Séparé du journal parce que masquer le score n'est pas un fait de match.

### Chrono

Le serveur ne compte pas. Le journal contient des événements « période démarrée », « chrono en pause », « chrono repris », « période terminée », « chrono corrigé ». L'état dérivé donne : période en cours, base de la période (0, 45, 90, 105 selon le format), temps écoulé au dernier changement, heure du serveur à ce changement, en marche ou non. Chaque écran calcule l'affichage avec l'heure du serveur, après mesure du décalage d'horloge à la connexion. Au-delà de la durée réglementaire, l'affichage passe en « 45+2 ». Le temps additionnel annoncé est un événement à part qui affiche le « +3 ».

### Profil de sport

Un profil décrit : les périodes et leurs durées, le sens du chrono, les types d'événements disponibles, la valeur d'un point, l'existence d'une séance de départage. Seul le profil football est écrit. Le format (2×45, 2×30, prolongations 2×15 ou non, tirs au but ou non, cinq tireurs ou autre) est un réglage du profil dans la configuration.

## 5. Temps réel

- Un WebSocket par page. À la connexion et à chaque changement, le serveur envoie l'instantané complet : configuration utile, état dérivé, affichage, numéro de révision, heure du serveur.
- Les pages de contrôle envoient des **commandes** avec un identifiant unique. Le serveur répond « accepté » ou « refusé » avec la raison. Une commande reçue deux fois n'est appliquée qu'une fois : un double appui ou un renvoi après coupure ne compte pas deux buts.
- Reconnexion automatique avec délai croissant. La page de contrôle affiche clairement « hors ligne » et met les commandes en attente plutôt que de les perdre.
- **Signaux d'animation.** Un but produit un fait dans le journal et un signal « joue l'animation de but ». Les signaux ne sont pas rejoués à une page qui se connecte après coup : recharger l'overlay en plein match ne relance pas le dernier but, mais retrouve le score, le chrono et les panneaux affichés.

## 6. Moteur d'affichage

Deux couches, communes à tous les thèmes et aux deux formats.

- **Permanent** : score et chrono, indication de période, temps additionnel, panneau des tirs au but, bandeau libre, panneaux plein écran (compositions, mi-temps, fin de match). Leur présence vient de l'état d'affichage, donc survit à un rechargement.
- **Moments** : but, but refusé, penalty, carton, remplacement, annonces. Ils passent par une **file** : un seul à la fois dans un même emplacement, enchaînés proprement. Un moment prioritaire (but) peut écourter le précédent. Le score ne roule qu'au moment prévu par l'animation du but, pas avant.

### Contrat d'un thème

Un thème est un dossier qui fournit, pour chaque élément ci-dessus, un composant avec trois phases — entrée, mise à jour, sortie — sous forme de timelines, en deux mises en page (16:9 et 9:16). Il reçoit des données déjà prêtes (noms, couleurs, logos, textes) et ne contient aucune logique de match. Un thème déclare aussi ses polices et ses réglages propres.

Changement de thème en direct : sortie de tout ce qui est affiché, bascule, entrée avec le nouveau thème. Le score et le chrono ne sont pas touchés.

### Performance

- On n'anime que transformations, opacité et découpes ; pas de flou ni d'ombre animés.
- Les variations de largeur de police sont réservées aux textes courts et aux entrées.
- Les éléments masqués sont retirés du rendu.
- Contrôle dans vMix et OBS dès la première étape, puis à chaque nouveau composant.

## 7. Thèmes

**Tigre** (principal). Référence : `docs/maquettes/02-tigre-mouvement.html`. Motif du coup de griffe (traits inclinés à 14°), police Anybody à largeur variable, orange `#EF5407`, noir `#0A0A0A`, blanc cassé `#F3EEE4`. Plein écran réservé au but et à la victoire ; le reste en bas à gauche.

**Régie** (sobre, sombre, compact) et **Clair** (pastille blanche centrée). Référence de départ : `docs/maquettes/01-directions-visuelles.html`. Chacun fera l'objet d'une étude de mouvement validée avant d'être construit, avec son propre motif et sa propre typographie.

Les couleurs d'équipe, logos et textes viennent de la configuration dans les trois thèmes. Le logo des profs étant sombre, il est toujours posé sur une pastille claire.

## 8. Page de contrôle

Pensée pour un téléphone tenu d'une main, sous pression.

- **En haut, toujours visibles** : score, chrono, période, état de la connexion, ce qui est à l'antenne.
- **Zone principale** : deux grandes colonnes, une par équipe, avec les actions fréquentes (but, carton, remplacement). Un but ouvre la liste des joueurs de l'équipe en grosses cases ; buteur, puis passeur facultatif, et un bouton « valider sans nom » toujours présent.
- **Barre du bas** : chrono (démarrer, pause, fin de période, temps additionnel), affichage (score, bandeaux, panneaux), et plus.
- **Corriger vite** : après chaque action, un bandeau « Annuler » reste dix secondes. Un historique liste tous les événements ; chacun peut être modifié (joueur, minute, équipe) ou annulé. Le score et le chrono ont aussi une correction directe.
- **Garde-fous** : confirmation pour les actions rares et lourdes (fin de match, remise à zéro), jamais pour un but. Les boutons sont désactivés quand l'action n'a pas de sens (pas de remplacement d'un joueur expulsé).
- **Aperçu** : une vignette de l'overlay en direct, pour voir ce que voit le public.

Protection : code PIN saisi une fois, qui donne un jeton gardé sur l'appareil. Les overlays n'acceptent aucune commande.

## 9. Scénarios couverts (football)

| Situation | Saisie | À l'antenne |
|---|---|---|
| Avant-match | Compte à rebours, affiche du match | Panneau plein écran |
| Compositions | Une équipe puis l'autre | Panneau avec titulaires et remplaçants |
| Coup d'envoi | Démarrer la période | Entrée du score |
| But | Équipe, buteur, passeur | Plein écran puis bandeau, score qui roule |
| But contre son camp | Variante du but | Bandeau « csc », point à l'adversaire |
| But refusé ou annulé | Depuis l'historique ou bouton dédié | Bandeau, score qui revient en arrière |
| But en cours de vérification | Bouton | Bandeau d'attente, puis validé ou refusé |
| Penalty | Accordé, puis marqué ou raté | Bandeau d'annonce, puis but ou « raté » |
| Carton jaune, rouge, deuxième jaune | Équipe, joueur | Carton animé ; le deuxième jaune est détecté et se retourne en rouge |
| Remplacement | Sortant, entrant | Bandeau, effectif mis à jour |
| Arrêt de jeu, blessure | Pause du chrono, motif facultatif | Indication discrète près du chrono |
| Pause fraîcheur | Bouton | Bandeau |
| Temps additionnel | Nombre de minutes | « +3 » près du chrono |
| Mi-temps | Fin de période | Panneau : score, buteurs, stats |
| Fin de match | Fin de période | Panneau de résumé ; homme du match facultatif |
| Prolongations | Si le format les prévoit | Périodes 3 et 4, mêmes outils |
| Tirs au but | Voir section 10 | Panneau dédié, puis annonce du vainqueur |
| Stats en direct | Compteurs (tirs, corners, fautes) | Panneau à la demande |
| Bandeaux libres | Titre et sous-titre, modèles enregistrés | Bandeau (commentateurs, BDT, sponsors, QR code) |
| Écran d'attente | Bouton | « De retour dans un instant » |
| Masquer ou afficher le score | Bouton | Sortie ou entrée animée |

## 10. Séance de tirs au but

- Réglages : nombre de tirs (cinq par défaut), équipe qui commence.
- Saisie tir par tir : tireur facultatif, marqué ou raté. Le panneau montre les cases des deux équipes et le score de la séance.
- La logique sait quand c'est fini : une équipe ne peut plus être rattrapée, ou, après égalité au bout de la série, un tir de chaque côté suffit à départager (mort subite). Elle propose alors l'annonce du vainqueur, sans la lancer toute seule.
- Chaque tir est un événement comme un autre : il s'annule et se corrige.
- Le score du match affiché garde le score à la fin du temps de jeu, avec le score de la séance à côté.

## 11. vMix et Companion

- **Table de déclencheurs** dans l'admin : pour un type d'événement (but, carton rouge, mi-temps, fin de match, victoire…), une liste d'appels à l'API HTTP de vMix avec un délai chacun. Exemple : sur un but, lancer le stinger numéro 2.
- Chaque ligne s'active séparément ; un interrupteur général coupe tout ; un bouton « tester » envoie l'appel hors match.
- L'adresse de vMix est réglable (par défaut le même PC). Un voyant indique si vMix répond.
- Un appel qui échoue est noté dans un journal visible dans l'admin et n'empêche jamais l'overlay de jouer son animation.
- Par défaut aucun déclencheur n'est actif. Les exemples fournis ne changent pas de plan à l'antenne.
- **Companion** : l'app expose des adresses HTTP simples (afficher ou masquer le score, lancer un bandeau enregistré, changer de thème) protégées par une clé, utilisables depuis Companion ou tout autre outil. Les actions de match (buts, cartons) restent sur la page de contrôle.

## 12. Format vertical

`/overlay/9x16` reçoit exactement le même état. Chaque thème fournit une mise en page dédiée : score en haut au centre, moments en bas au-dessus de la zone occupée par l'interface de TikTok, plein écran recomposé en hauteur. Les marges de sécurité sont réglables.

La production du flux vertical lui-même (seconde instance, OBS en parallèle ou autre) est une question de régie, à trancher avant cette étape ; elle ne change rien à l'app.

## 13. Simulation

`/simulation` rejoue un scénario écrit à l'avance en envoyant les mêmes commandes que la page de contrôle : avant-match, compositions, coup d'envoi, buts, but refusé, penalty, cartons dont un deuxième jaune, remplacements, temps additionnel, mi-temps, seconde période, égalisation, prolongations, tirs au but avec mort subite, annonce du vainqueur. Vitesse réglable, pause, saut à un chapitre. Elle travaille sur un match à part et ne peut pas écraser un vrai match en cours.

## 14. Robustesse

- Écriture sur disque avant confirmation ; au démarrage le serveur relit le journal et reprend exactement où il en était.
- Une ligne de journal abîmée par une coupure est ignorée et signalée, le reste est conservé.
- Sauvegarde automatique du journal à chaque fin de période, et export manuel.
- Archivage d'un match terminé et création d'un nouveau, sans perdre l'ancien.
- Les overlays se reconnectent seuls et gardent leur dernier état affiché pendant la coupure ; le chrono continue de tourner localement.
- Un script de lancement Windows (double-clic) démarre le serveur.

## 15. Tests

- **Logique** (le plus important) : réducteur, chrono et temps additionnel, détection du deuxième jaune, fin de séance de tirs au but dans tous les cas, annulation et modification d'événements, commande reçue deux fois, relecture d'un journal après redémarrage.
- **Serveur** : authentification, refus des commandes venant d'un overlay, reconnexion.
- **Pages** : la simulation complète tourne sans erreur dans un navigateur automatisé ; captures de contrôle des composants.
- **À la main, à chaque étape** : fluidité dans vMix et dans OBS.

## 16. Étapes

Chaque étape se termine par quelque chose que tu peux lancer et juger.

1. **Socle.** Serveur, journal, chrono, WebSocket, contrôle minimal, score du thème Tigre. Résultat : le score animé dans vMix et OBS, qui survit à un redémarrage.
2. **Moments de match en Tigre et simulation.** But, but refusé, penalty, cartons, remplacement, temps additionnel, file de moments. Résultat : un match simulé jusqu'à la fin du temps de jeu.
3. **Page de contrôle complète.** Effectifs, annulation, historique, PIN, aperçu. Résultat : un match saisi au téléphone.
4. **Panneaux.** Avant-match, compositions, mi-temps, fin de match, stats, bandeaux libres, écran d'attente.
5. **Prolongations et tirs au but.** Résultat : la simulation va jusqu'à l'annonce du vainqueur.
6. **Admin et thèmes.** Configuration sans code, changement de thème en direct, puis Régie et Clair (étude de mouvement validée avant chacun).
7. **Format vertical.**
8. **vMix et Companion.**
9. **README, lancement Windows, répétition générale** en conditions réelles avec la régie complète.

## 17. Hors périmètre

- Un deuxième sport : l'architecture le prévoit, mais seul le football est construit.
- Plusieurs matchs en parallèle, comptes utilisateurs, hébergement en ligne.
- Gestion des caméras, du son et des replays : c'est le rôle de vMix.
