# matchday-overlay

Habillage de score animé pour les lives du BDT, piloté depuis un téléphone et affiché dans vMix ou OBS.

État actuel : tout un match de foot se gère en thème Tigre, du compte à rebours à la séance de tirs au but ; tout se configure depuis la page d'admin ; les déclencheurs vMix et les adresses pour Companion sont en place. Restent les thèmes Régie et Clair et le format vertical, décrits dans `docs/superpowers/specs/2026-10-08-matchday-overlay-design.md`.

## Lancer

Il faut Node.js 24 et pnpm.

- Double-clic sur `start.bat`, ou dans un terminal : `pnpm install` puis `pnpm start`.
- La console affiche les adresses et un QR code pour ouvrir le contrôle sur le téléphone (même réseau WiFi que le PC).

| Page | Adresse |
|---|---|
| Overlay 16:9 | `http://localhost:4455/overlay/16x9` |
| Contrôle | `http://localhost:4455/control` |
| Simulation | `http://localhost:4455/simulation` |
| Admin | `http://localhost:4455/admin` |

Le contrôle, l'admin et la simulation demandent un **code PIN** à quatre chiffres, affiché dans la console au démarrage. Il est tiré au hasard à la première utilisation et se change dans la page d'admin ; le changer déconnecte tous les téléphones. Les overlays n'ont pas besoin de code et n'acceptent aucune commande.

Pour voir l'overlay dans un navigateur ordinaire, ajoute `?bg` à l'adresse : il met un fond sombre à la place de la transparence.

Si Windows demande d'autoriser Node.js sur le réseau, accepte pour les réseaux privés, sinon le téléphone ne pourra pas se connecter.

## Ajouter l'overlay dans vMix

1. Add Input → Web Browser.
2. URL : `http://localhost:4455/overlay/16x9`, largeur 1920, hauteur 1080.
3. Place l'entrée dans un canal Overlay (ou en couche au-dessus de la caméra). Le fond est transparent.

## Ajouter l'overlay dans OBS

1. Sources → + → Navigateur.
2. URL : `http://localhost:4455/overlay/16x9`, largeur 1920, hauteur 1080.
3. Laisse le CSS personnalisé par défaut (fond transparent).

## Configuration (page d'admin)

`http://localhost:4455/admin`, à ouvrir de préférence sur le PC. Tout s'applique à l'enregistrement, sans redémarrer, et le match en cours n'est pas touché.

- **Événement** : nom, sous-titre, message de l'écran d'attente, thème.
- **Équipes** : nom, sigle, couleur, logo (PNG, JPEG, WebP ou SVG, 2 Mo au plus), et la case « logo sombre » qui le pose sur un fond clair.
- **Joueurs** : numéro, nom, titulaire ou remplaçant ; ajout et retrait.
- **Format** : nombre et durée des périodes, prolongations, tirs au but.
- **Bandeaux enregistrés** : titre, sous-titre, lien pour QR code.
- **Code PIN**.

Une valeur invalide est refusée avec un message qui dit laquelle. La configuration est écrite dans `data/config.json` et les logos envoyés dans `data/uploads/` ; modifier le fichier à la main reste possible, serveur arrêté.

## vMix et Companion

### Déclencher des actions dans vMix

Dans la page d'admin, section « vMix ».

1. Dans vMix : Réglages → Web Controller, coche l'activation et note le port (8088 par défaut).
2. Dans l'admin : vérifie l'adresse (`http://127.0.0.1:8088` si vMix est sur le même PC) et clique « Vérifier la connexion ». La version de vMix doit s'afficher.
3. Ajoute un déclencheur : choisis l'événement (but, carton rouge, fin du match, annonce du vainqueur…), puis la fonction vMix et ses paramètres, tels qu'ils apparaissent dans la liste des fonctions de l'API vMix (`Function`, `Input`, `Value`, `Duration`).
4. « Tester » envoie l'appel tout de suite pour voir l'effet dans vMix.
5. Coche « Actif » sur la ligne, puis « Activer les déclencheurs pendant le match », et enregistre.

À savoir :

- Rien n'est actif au départ. Les trois lignes fournies sont des exemples à adapter (un jingle en overlay sur un but, un marquage de replay, un générique à l'annonce du vainqueur) ; aucun ne change de plan à l'antenne. Les noms d'inputs sont inventés : remplace-les par les tiens.
- Un stinger est une transition dans vMix : la fonction `Stinger1` envoie le plan de prévisualisation à l'antenne. Ne l'accroche à un but que si c'est ce que tu veux.
- Si vMix ne répond pas, l'appel est noté dans « Derniers appels » et l'habillage s'affiche quand même.
- Une correction sans annonce (bouton + du score) ne déclenche rien, et rien ne part pendant une simulation.
- Un délai en millisecondes permet de caler l'appel sur l'animation (le plein écran d'un but dure environ deux secondes et demie).

### Piloter l'affichage depuis Companion ou un Stream Deck

La section « Companion et Stream Deck » de l'admin liste des adresses prêtes à copier, avec leur clé. Dans Companion, ajoute une connexion « Generic HTTP » et une action GET par bouton.

| Adresse | Effet |
|---|---|
| `/api/do/score/toggle` (ou `show`, `hide`) | Afficher ou masquer le score |
| `/api/do/banner/1` (ou `2`, `3`…, `off`) | Lancer ou retirer un bandeau enregistré |
| `/api/do/panel/summary` (ou `prematch`, `lineup-home`, `lineup-away`, `stats`, `holding`, `off`) | Afficher ou retirer un panneau |
| `/api/do/theme/tigre` | Changer de thème |

Toutes prennent `?key=…`. Les buts, cartons et tirs au but ne passent pas par là : ils restent sur la page de contrôle, où l'on choisit le joueur.

Pour les plans de caméra, les replays et le son, le module vMix de Companion fait déjà le travail : inutile de passer par cette app.

## Page de contrôle

- **Deux colonnes, une par équipe** : but, cartons, remplacement, penalty. Chaque action ouvre la grille des joueurs ; « Valider sans nom » est toujours disponible.
- **Annuler** : après chaque action, une barre reste dix secondes en bas de l'écran pour l'annuler d'un appui.
- **Historique** : touche un événement pour changer le joueur, la minute ou l'équipe, refuser un but à l'antenne, ou le supprimer sans annonce.
- **Corrections sans annonce** : boutons + et − sur le score, et réglage direct du chrono (par exemple `67:24`).
- **Aperçu** : « Voir l'aperçu » affiche l'overlay en direct dans la page.
- Un joueur expulsé est grisé ; pour un remplacement, seuls les joueurs sur le terrain peuvent sortir et ceux du banc entrer.

## Panneaux, bandeaux et stats

Dans le contrôle, sous « Antenne » :

- **Panneaux** : avant-match (avec ou sans compte à rebours), composition de chaque équipe, résumé, stats, écran d'attente. Un appui affiche, un second retire. Tous couvrent l'image et masquent le score, sauf les stats.
- **Résumé** : il s'intitule tout seul « Mi-temps » ou « Fin du match » selon le chrono, et montre le score, les buteurs et les stats saisies. Une fois affiché, deux boutons permettent de désigner l'homme du match.
- **Bandeaux** : ceux enregistrés dans la page d'admin se lancent d'un appui ; on peut aussi taper un titre et un sous-titre libres. Un bandeau avec un champ `qr` affiche le lien en QR code. Le bandeau s'efface tout seul pendant un but ou un carton, puis revient.
- **Stats** : un appui sur un compteur ajoute 1 ; le mode correction retire 1. Les cartons sont comptés automatiquement.
- Les textes des panneaux (nom de l'événement, message d'attente) se changent dans la page d'admin.

Ce qui est affiché survit à un rechargement de l'overlay et à un redémarrage du serveur.

## Prolongations et tirs au but

Le format se règle dans la page d'admin : prolongations (deux périodes, 15 minutes par défaut) et tirs au but (cinq par équipe par défaut), chacun activable. Les deux sont actifs au départ.

- À la fin du temps réglementaire sur une égalité, le contrôle propose ce que le format permet : lancer la prolongation, passer aux tirs au but (en choisissant qui tire en premier), ou terminer sur ce score. Avec les deux options désactivées, le match se termine tout seul.
- Pendant la séance, deux gros boutons « Marqué » et « Raté » pour l'équipe dont c'est le tour. Le panneau s'affiche tout seul, avec une case par tir.
- L'app sait quand c'est fini : une équipe qui ne peut plus être rattrapée, ou la mort subite après une série à égalité (une case de plus s'ouvre à chaque tour).
- « Annuler le dernier tir » corrige une erreur, même après la fin de la séance.
- Le vainqueur n'est jamais annoncé tout seul : le bouton « Annoncer le vainqueur à l'antenne » lance le plein écran. Il existe aussi pour un match gagné dans le temps de jeu.

## Simulation

La page de simulation rejoue un match complet (avant-match, compositions, buts, penalty, but refusé, cartons, deuxième jaune, remplacement, stats, résumés, prolongations, tirs au but avec mort subite, annonce du vainqueur) pour juger les animations sans être sur le terrain. Elle montre un aperçu de l'overlay, et l'entrée vMix ou OBS affiche la même chose au même moment.

Le vrai match est mis de côté pendant la simulation et revient intact avec « Quitter ». Seule exception : le panneau et le bandeau à l'antenne sont retirés au lancement et à la sortie de la simulation. Un redémarrage du serveur revient aussi au vrai match.

## Ce qui est sauvegardé

Tout est dans le dossier `data/` :

- `match.jsonl` : le journal du match, une ligne par événement, écrite sur disque à chaque action ;
- `display.json` : ce qui est à l'antenne (score affiché ou masqué) ;
- `config.json` : toute la configuration et le code PIN, écrits par la page d'admin. Les joueurs fournis au départ sont des exemples à remplacer ;
- `uploads/` : les logos envoyés depuis l'admin ;
- `archive/` : les matchs précédents, mis de côté par « Nouveau match ».

Recharger l'overlay ou redémarrer le serveur ne perd ni le score ni le chrono.

## Développement

- `pnpm test` : tests de la logique de match et du serveur.
- `pnpm check` : vérification des types.
- `pnpm dev:server` et `pnpm dev:web` : serveur et pages avec rechargement à chaud (pages sur le port 5173).
