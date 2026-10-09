import qrcode from 'qrcode-generator';

// Petits outils communs aux thèmes : couleurs lisibles, tailles de texte, QR code, compte à rebours.

/** Couleur de texte lisible sur un fond donné : noir sur clair, blanc cassé sur sombre. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => (c / 255) ** 2.2;
  const luminance = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return luminance > 0.2 ? '#0a0a0a' : '#f3eee4';
}

/** Couleur d'équipe éclaircie si elle est trop sombre pour ressortir sur le noir. */
export function onDark(hex: string): string {
  if (inkOn(hex) === '#0a0a0a') return hex;
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (243 - c) * 0.55);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/** Taille de police qui fait tenir un texte sur une ligne : `max` tant qu'il est court, puis réduite en proportion. */
export const fit = (text: string, max: number, room: number) => Math.min(max, Math.round(room / Math.max(text.length, 1)));

/** Lettres d'un texte, l'espace devenant insécable pour garder sa largeur une fois découpé. */
export const letters = (text: string) => [...text].map((c) => (c === ' ' ? ' ' : c));

/** Tracé SVG d'un QR code : un petit carré par module sombre. */
export function qrPath(link: string): { size: number; path: string } {
  const code = qrcode(0, 'M');
  code.addData(link);
  code.make();
  const size = code.getModuleCount();
  let path = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (code.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
  return { size, path };
}

/** Texte du compte à rebours avant le coup d'envoi : « 04:59 », puis « C'est parti » ; vide s'il n'y a pas d'heure. */
export function countdownText(remaining: number | null): string {
  if (remaining === null) return '';
  if (remaining <= 0) return "C'est parti";
  const s = Math.ceil(remaining / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Couleur d'équipe assombrie si elle est trop claire pour se lire sur du blanc. */
export function onLight(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => (c / 255) ** 2.2;
  const luminance = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  if (luminance < 0.4) return hex;
  const mix = (c: number) => Math.round(c * 0.6);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
