import { mount } from 'svelte';
import gsap from 'gsap';
import Overlay from './Overlay.svelte';

// Certains éléments sont facultatifs (ligne de détail, deuxième carton) : pas d'alerte quand ils manquent.
gsap.config({ nullTargetWarn: false });

// ?bg ajoute un fond sombre pour juger l'habillage dans un navigateur, hors vMix.
if (new URLSearchParams(location.search).has('bg')) document.documentElement.style.background = '#22382b';

mount(Overlay, { target: document.getElementById('app')! });
