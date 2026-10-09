## Matchday Overlay

Pilote l'habillage de match [matchday-overlay](https://github.com/Mathr81/matchday-overlay) depuis Companion.

### Réglages

- **Adresse** : celle du PC qui fait tourner matchday-overlay (`127.0.0.1` si c'est le même PC que Companion).
- **Port** : 4455, sauf si tu l'as changé.
- **Clé** : celle de la page d'admin de matchday-overlay, section « Companion et Stream Deck ».

La connexion passe au vert quand le match est reçu et que la clé est bonne.

### Actions

- **Affichage** : score, panneaux (avant-match, compositions, résumé, stats, écran d'attente), bandeaux enregistrés ou bandeau libre, thème.
- **Chrono** : coup d'envoi de la période suivante, pause, reprise, fin de période, temps additionnel.
- **Match** : but (avec ou sans buteur, sur penalty, contre son camp, correction sans animation), carton, penalty annoncé ou raté, compteurs de stats, fin du match, annonce du vainqueur.
- **Tirs au but** : début de la séance, tir marqué ou raté.

La remise à zéro du match, la simulation, les remplacements et les corrections restent sur la page de contrôle.

### Retours d'état

Score affiché, panneau affiché, bandeau affiché, thème actif, phase du match, équipe qui mène, équipe qui doit tirer, simulation en cours.

### Variables

Score, noms et sigles des équipes, chrono, période, temps additionnel, stats, tirs au but, panneau, bandeau, thème. La liste complète est dans l'onglet Variables de la connexion.

### Boutons tout faits

L'onglet Presets propose des boutons prêts à glisser, aux couleurs des équipes.
