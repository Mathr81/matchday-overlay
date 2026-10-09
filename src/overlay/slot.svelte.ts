/** Emplacement d'un élément permanent : quand le contenu voulu change, l'ancien joue sa sortie avant que le nouveau entre. */
export class Slot<T> {
  shown = $state<T | null>(null);
  leaving = $state(false);
  #want: T | null = null;

  /** Identifie le contenu affiché, pour remonter le composant quand il change. */
  get key() {
    return JSON.stringify(this.shown);
  }

  set(want: T | null) {
    if (JSON.stringify(want) === JSON.stringify(this.#want)) return;
    this.#want = want;
    if (this.shown === null) this.shown = want;
    else this.leaving = true;
  }

  /** À appeler par le composant une fois sa sortie terminée. */
  gone = () => {
    this.leaving = false;
    this.shown = this.#want;
  };
}
