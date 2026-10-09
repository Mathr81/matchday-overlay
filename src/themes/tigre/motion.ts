import gsap from 'gsap';

export const OUT = 'expo.out';
export const ALERT = '#F0323C';

export { fit, inkOn, letters, onDark } from '../util';

/** Sortie commune des panneaux : les blocs se referment en cascade, puis `ongone` est appelé. */
export function leave(root: HTMLElement, ongone: () => void): gsap.core.Timeline {
  const q = gsap.utils.selector(root);
  return gsap
    .timeline({ onComplete: ongone })
    .to(q('.para'), { '--q': 1, duration: 0.4, ease: 'expo.inOut', stagger: { amount: 0.25, from: 'end' } }, 0)
    .to(root, { autoAlpha: 0, duration: 0.3 }, '-=0.25');
}
