# matchday-overlay

Habillage de score animé pour les lives du BDT, piloté depuis un téléphone et affiché dans vMix ou OBS.

État actuel : **étape 2 sur 9**. Le score, le chrono, les moments de match du thème Tigre (but, but refusé, penalty, cartons, remplacement) et la simulation fonctionnent ; le reste est décrit dans `docs/superpowers/specs/2026-10-08-matchday-overlay-design.md`.

## Lancer

Il faut Node.js 24 et pnpm.

- Double-clic sur `start.bat`, ou dans un terminal : `pnpm install` puis `pnpm start`.
- La console affiche les adresses et un QR code pour ouvrir le contrôle sur le téléphone (même réseau WiFi que le PC).

| Page | Adresse |
|---|---|
| Overlay 16:9 | `http://localhost:4455/overlay/16x9` |
| Contrôle | `http://localhost:4455/control` |
| Simulation | `http://localhost:4455/simulation` |

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

## Simulation

La page de simulation rejoue un match complet (buts, penalty, but refusé, cartons, deuxième jaune, remplacement, temps additionnel) pour juger les animations sans être sur le terrain. Elle montre un aperçu de l'overlay, et l'entrée vMix ou OBS affiche la même chose au même moment.

Le vrai match est mis de côté pendant la simulation et revient intact avec « Quitter ». Un redémarrage du serveur revient aussi au vrai match.

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
