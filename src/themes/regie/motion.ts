import gsap from 'gsap';

export const OUT = 'expo.out';
export const ALERT = '#ff4548';

export { fit, inkOn, onDark } from '../util';

/**
 * Décodage : les chiffres défilent au hasard puis se figent de gauche à droite sur leur valeur.
 * À n'utiliser que sur un texte qui ne change plus ensuite.
 */
export function decode(el: Element | undefined, duration = 0.55): void {
  if (!el) return;
  const final = el.textContent ?? '';
  const state = { p: 0 };
  gsap.to(state, {
    p: 1,
    duration,
    ease: 'none',
    onUpdate: () => {
      const fixed = Math.floor(state.p * final.length);
      el.textContent = [...final].map((c, i) => (i < fixed || !/\d/.test(c) ? c : String(Math.floor(Math.random() * 10)))).join('');
    },
    onComplete: () => (el.textContent = final),
  });
}

/** Sortie commune des panneaux : les textes s'effacent, les surfaces se replient, les traits se rétractent. */
export function leave(root: HTMLElement, ongone: () => void): gsap.core.Timeline {
  const q = gsap.utils.selector(root);
  return gsap
    .timeline({ onComplete: ongone })
    .to(q('.rise'), { yPercent: -115, duration: 0.3, ease: 'power3.in', stagger: { amount: 0.15 } }, 0)
    .to(q('.fade'), { opacity: 0, duration: 0.25 }, 0)
    .to(q('.sheet'), { '--r': 0, duration: 0.4, ease: 'expo.inOut', stagger: { amount: 0.15, from: 'end' } }, 0.15)
    .to(q('.rule'), { scaleX: 0, duration: 0.35, ease: 'expo.in' }, 0.3)
    .to(root, { autoAlpha: 0, duration: 0.25 }, 0.5);
}
