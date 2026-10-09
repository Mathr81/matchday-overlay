# matchday-overlay

Habillage de score animé pour les lives du BDT, piloté depuis un téléphone et affiché dans vMix ou OBS.

État actuel : **étape 5 sur 9**. Tout un match de foot se gère en thème Tigre, du compte à rebours à la séance de tirs au but : score, chrono, moments, panneaux, bandeaux, prolongations, tirs au but, page de contrôle et simulation. Le reste (admin, autres thèmes, format vertical, vMix) est décrit dans `docs/superpowers/specs/2026-10-08-matchday-overlay-design.md`.

## Lancer

Il faut Node.js 24 et pnpm.

- Double-clic sur `start.bat`, ou dans un terminal : `pnpm install` puis `pnpm start`.
- La console affiche les adresses et un QR code pour ouvrir le contrôle sur le téléphone (même réseau WiFi que le PC).

| Page | Adresse |
|---|---|
| Overlay 16:9 | `http://localhost:4455/overlay/16x9` |
| Contrôle | `http://localhost:4455/control` |
| Simulation | `http://localhost:4455/simulation` |

Le contrôle et la simulation demandent un **code PIN** à quatre chiffres, affiché dans la console au démarrage. Il est tiré au hasard à la première utilisation et se change dans `data/config.json` (champ `pin`, puis redémarrer) ; le changer déconnecte tous les téléphones. Les overlays n'ont pas besoin de code et n'acceptent aucune commande.

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
- **Bandeaux** : ceux enregistrés dans `data/config.json` (section `banners`) se lancent d'un appui ; on peut aussi taper un titre et un sous-titre libres. Un bandeau avec un champ `qr` affiche le lien en QR code. Le bandeau s'efface tout seul pendant un but ou un carton, puis revient.
- **Stats** : un appui sur un compteur ajoute 1 ; le mode correction retire 1. Les cartons sont comptés automatiquement.
- Les textes des panneaux (nom de l'événement, message d'attente) sont dans la section `texts` de `data/config.json`.

Ce qui est affiché survit à un rechargement de l'overlay et à un redémarrage du serveur.

## Prolongations et tirs au but

Le format du match est dans `data/config.json`, section `format` :

```json
"format": {
  "periodMinutes": 45,
  "periods": 2,
  "extraTime": { "enabled": true, "periodMinutes": 15 },
  "shootout": { "enabled": true, "kicks": 5 }
}
```

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
- `config.json` : équipes, couleurs, logos, joueurs, durée des périodes. Les joueurs fournis sont des exemples à remplacer. Modifiable à la main pour l'instant, puis redémarrer le serveur ;
- `archive/` : les matchs précédents, mis de côté par « Nouveau match ».

Recharger l'overlay ou redémarrer le serveur ne perd ni le score ni le chrono.

## Développement

- `pnpm test` : tests de la logique de match et du serveur.
- `pnpm check` : vérification des types.
- `pnpm dev:server` et `pnpm dev:web` : serveur et pages avec rechargement à chaud (pages sur le port 5173).
