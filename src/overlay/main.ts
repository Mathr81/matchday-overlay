import gsap from 'gsap';
import { mount } from 'svelte';
import Overlay from './Overlay.svelte';

// Certains éléments sont facultatifs (ligne de détail, deuxième carton) : pas d'alerte quand ils manquent.
gsap.config({ nullTargetWarn: false });
// Si l'affichage saccade ou que la source est ralentie, les animations suivent quand même l'heure réelle
// au lieu de prendre du retard sur le match.
gsap.ticker.lagSmoothing(0);

const page = document.createElement('style');
page.textContent = 'html, body { margin: 0; background: transparent; overflow: hidden; }';
document.head.append(page);

// ?bg ajoute un fond sombre pour juger l'habillage dans un navigateur, hors vMix.
if (new URLSearchParams(location.search).has('bg')) document.documentElement.style.background = '#22382b';

// La même page sert les deux formats : l'adresse dit lequel.
mount(Overlay, { target: document.getElementById('app')!, props: { tall: location.pathname.includes('9x16') } });
