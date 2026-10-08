import { mount } from 'svelte';
import Overlay from './Overlay.svelte';

// ?bg ajoute un fond sombre pour juger l'habillage dans un navigateur, hors vMix.
if (new URLSearchParams(location.search).has('bg')) document.documentElement.style.background = '#22382b';

mount(Overlay, { target: document.getElementById('app')! });
