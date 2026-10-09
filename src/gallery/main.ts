import gsap from 'gsap';
import { mount } from 'svelte';
import Gallery from './Gallery.svelte';

gsap.config({ nullTargetWarn: false });
gsap.ticker.lagSmoothing(0);

mount(Gallery, { target: document.getElementById('app')! });
