import gsap from 'gsap';
import { mount } from 'svelte';
import Overlay from './Overlay.svelte';

// Certains éléments sont facultatifs (ligne de détail, deuxième carton) : pas d'alerte quand ils manquent.
gsap.config({ nullTargetWarn: false });
// Si l'affichage saccade ou que la source est ralentie, les animations suivent quand même l'heure réelle
// au lieu de prendre du retard sur le match.
gsap.ticker.lagSmoothing(0);

// ?bg ajoute un fond sombre pour juger l'habillage dans un navigateur, hors vMix.
if (new URLSearchParams(location.search).has('bg')) document.documentElement.style.background = '#22382b';

mount(Overlay, { target: document.getElementById('app')! });
