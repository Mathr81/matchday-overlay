import gsap from 'gsap';

export const OUT = 'expo.out';
export const ALERT = '#F0323C';

/** Couleur de texte lisible sur un fond donné : noir sur clair, blanc cassé sur sombre. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => ((c / 255) ** 2.2);
  const luminance = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return luminance > 0.2 ? '#0a0a0a' : '#f3eee4';
}

/** Taille de police qui fait tenir un texte sur une ligne : `max` tant qu'il est court, puis réduite en proportion. */
export const fit = (text: string, max: number, room: number) => Math.min(max, Math.round(room / Math.max(text.length, 1)));

/** Lettres d'un texte, l'espace devenant insécable pour garder sa largeur une fois découpé. */
export const letters = (text: string) => [...text].map((c) => (c === ' ' ? '\u00a0' : c));

/** Sortie commune des panneaux : les blocs se referment en cascade, puis `ongone` est appelé. */
export function leave(root: HTMLElement, ongone: () => void): gsap.core.Timeline {
  const q = gsap.utils.selector(root);
  return gsap
    .timeline({ onComplete: ongone })
    .to(q('.para'), { '--q': 1, duration: 0.4, ease: 'expo.inOut', stagger: { amount: 0.25, from: 'end' } }, 0)
    .to(root, { autoAlpha: 0, duration: 0.3 }, '-=0.25');
}

/** Couleur d'équipe éclaircie si elle est trop sombre pour ressortir sur le noir. */
export function onDark(hex: string): string {
  if (inkOn(hex) === '#0a0a0a') return hex;
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (243 - c) * 0.55);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
