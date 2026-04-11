// 1) Purpose:
// - Logique d’empilement inspirée de Tower Blocks (html-css-javascript-games / Three.js) en 2D : chevauchement, bonus « parfait », vitesses.
// 2) Key variables:
// - `TB_MIN_OVERLAP_PX` : défaite si la tranche utile est trop fine ; `TB_PERFECT_EPS_PX` : tolérance bonus comme `0.3` unités dans le script source.
// 3) Logic flow:
// - Segments 1D (centre + largeur) → intersection ; bonus si presque aucune chute de matière.

export const TB_PLAY_WIDTH = 280;
export const TB_SLICE_HEIGHT = 28;
/** Seuil de défaite (px de largeur restante). */
export const TB_MIN_OVERLAP_PX = 6;
/** Si la partie « coupée » est inférieure à ce px, on considère un empilement parfait (bonus + alignement sur le bloc du dessous). */
export const TB_PERFECT_EPS_PX = 3;

export type TowerPlaceResult =
  | { ok: false }
  | { ok: true; newCenter: number; newWidth: number; perfect: boolean };

// 1) Purpose: calculer la pose après arrêt du bloc courant sur le précédent (axe horizontal).
// 2) Key variables: `movingCenter` / `movingWidth` (bloc actif) ; `prevCenter` / `prevWidth` (sommet de la tour).
// 3) Logic flow: intersection [ml,mr] ∩ [pl,pr] ; bonus si chute négligeable ; échec si largeur < min.
export function towerComputePlace(
  movingCenter: number,
  movingWidth: number,
  prevCenter: number,
  prevWidth: number,
): TowerPlaceResult {
  const ml = movingCenter - movingWidth / 2;
  const mr = movingCenter + movingWidth / 2;
  const pl = prevCenter - prevWidth / 2;
  const pr = prevCenter + prevWidth / 2;
  const lo = Math.max(ml, pl);
  const hi = Math.min(mr, pr);
  const overlapW = hi - lo;
  if (overlapW < TB_MIN_OVERLAP_PX) return { ok: false };

  const chopped = movingWidth - overlapW;
  if (chopped >= 0 && chopped < TB_PERFECT_EPS_PX) {
    return { ok: true, newCenter: prevCenter, newWidth: prevWidth, perfect: true };
  }

  const newWidth = overlapW;
  const newCenter = (lo + hi) / 2;
  return { ok: true, newCenter, newWidth, perfect: false };
}

// 1) Purpose: amplitude d’oscillation (équivalent `MOVE_AMOUNT` ≈ 12 dans le jeu 3D, adapté en px).
// 2) Key variables: `movingWidth`, largeur de jeu.
// 3) Logic flow: laisse dépasser légèrement pour tension, avec borne max.
export function towerOscillationAmplitude(playW: number, movingWidth: number): number {
  const margin = (playW - movingWidth) / 2;
  return Math.min(72, Math.max(24, margin + 16));
}

// 1) Purpose: vitesse de translation (équivalent `speed` qui augmente avec l’indice de couche).
// 2) Key variables: `layerIndex` ≥ 1 pour le bloc mobile.
// 3) Logic flow: croissance modérée, plafonnée (comme le cap `-4` du script source, ici en px/frame ~60fps).
export function towerSpeedPxPerFrame(layerIndex: number): number {
  const base = 1.35 + layerIndex * 0.16;
  return Math.min(5.2, base);
}

// 1) Purpose: couleur de couche dérivée des sinus du script Three.js (`r,g,b` à partir de `index + colorOffset`).
// 2) Key variables: canaux 0–255 pour CSS `rgb`.
// 3) Logic flow: même formule que `new THREE.Color(r/255, ...)`.
export function towerLayerRgb(index: number, colorOffset: number): { r: number; g: number; b: number } {
  const o = index + colorOffset;
  const r = Math.sin(0.3 * o) * 55 + 200;
  const g = Math.sin(0.3 * o + 2) * 55 + 200;
  const b = Math.sin(0.3 * o + 4) * 55 + 200;
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}
