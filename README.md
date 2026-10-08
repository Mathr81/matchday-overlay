# matchday-overlay

Habillage de score animé pour les lives du BDT, piloté depuis un téléphone et affiché dans vMix ou OBS.

État actuel : **étape 1 sur 9** (le socle). Le score du thème Tigre, le chrono et un contrôle minimal fonctionnent ; le reste est décrit dans `docs/superpowers/specs/2026-10-08-matchday-overlay-design.md`.

## Lancer

Il faut Node.js 24 et pnpm.

- Double-clic sur `start.bat`, ou dans un terminal : `pnpm install` puis `pnpm start`.
- La console affiche les adresses et un QR code pour ouvrir le contrôle sur le téléphone (même réseau WiFi que le PC).

| Page | Adresse |
|---|---|
| Overlay 16:9 | `http://localhost:4455/overlay/16x9` |
| Contrôle | `http://localhost:4455/control` |

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

## Ce qui est sauvegardé

Tout est dans le dossier `data/` :

- `match.jsonl` : le journal du match, une ligne par événement, écrite sur disque à chaque action ;
- `display.json` : ce qui est à l'antenne (score affiché ou masqué) ;
- `config.json` : équipes, couleurs, logos, durée des périodes. Modifiable à la main pour l'instant, puis redémarrer le serveur ;
- `archive/` : les matchs précédents, mis de côté par « Nouveau match ».

Recharger l'overlay ou redémarrer le serveur ne perd ni le score ni le chrono.

## Développement

- `pnpm test` : tests de la logique de match et du serveur.
- `pnpm check` : vérification des types.
- `pnpm dev:server` et `pnpm dev:web` : serveur et pages avec rechargement à chaud (pages sur le port 5173).
