import gsap from 'gsap';

export const POP = 'back.out(1.9)';
export const SPRING = 'elastic.out(1, 0.55)';
export const OUT = 'expo.out';
export const ALERT = '#e5383b';

export { fit, inkOn, letters, onLight } from '../util';

/** Apparition douce d'un texte : il monte un peu en sortant du flou. */
export const softFrom = { opacity: 0, y: 16, filter: 'blur(8px)' };
export const softTo = { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' };

/** Sortie commune des panneaux : les éléments ronds se dégonflent, les cartes rétrécissent et s'effacent. */
export function leave(root: HTMLElement, ongone: () => void): gsap.core.Timeline {
  const q = gsap.utils.selector(root);
  return gsap
    .timeline({ onComplete: ongone })
    .to(q('.pop'), { scale: 0, duration: 0.3, ease: 'back.in(1.8)', stagger: { amount: 0.18, from: 'end' } }, 0)
    .to(q('.tx'), { opacity: 0, duration: 0.2 }, 0)
    .to(q('.card'), { scale: 0.86, opacity: 0, duration: 0.35, ease: 'back.in(1.4)', stagger: { amount: 0.12, from: 'end' } }, 0.12)
    .to(root, { autoAlpha: 0, duration: 0.25 }, 0.35);
}

/** Confettis : chaque pièce part du centre, monte en éventail puis retombe en tournant. */
export function confetti(tl: gsap.core.Timeline, pieces: Element[], at: number, reach = 620): void {
  pieces.forEach((piece, i) => {
    const angle = (-Math.PI * (0.1 + 0.8 * ((i * 0.618) % 1))) + (i % 2 ? 0.08 : -0.08);
    const far = reach * (0.45 + ((i * 0.37) % 1) * 0.6);
    const x = Math.cos(angle) * far;
    const y = Math.sin(angle) * far;
    const spin = (i % 2 ? 1 : -1) * (180 + (i % 5) * 90);
    tl.fromTo(piece, { x: 0, y: 0, scale: 0, opacity: 1, rotation: 0 }, { x, y, scale: 1, rotation: spin, duration: 0.7, ease: 'power3.out', immediateRender: false }, at + (i % 6) * 0.015)
      .to(piece, { y: y + 380, x: x * 1.12, rotation: spin * 2, opacity: 0, duration: 1.1, ease: 'power1.in' }, at + 0.6 + (i % 6) * 0.015);
  });
}
