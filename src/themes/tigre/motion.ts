export const OUT = 'expo.out';
export const ALERT = '#F0323C';

/** Couleur de texte lisible sur un fond donné : noir sur clair, blanc cassé sur sombre. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => ((c / 255) ** 2.2);
  const luminance = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return luminance > 0.2 ? '#0a0a0a' : '#f3eee4';
}

/** Lettres d'un texte, l'espace devenant insécable pour garder sa largeur une fois découpé. */
export const letters = (text: string) => [...text].map((c) => (c === ' ' ? '\u00a0' : c));
