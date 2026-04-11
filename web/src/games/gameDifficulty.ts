// 1) Purpose:
// - Niveaux de difficulté communs aux mini-jeux NaviSphere (IA réutilisable, réglages centralisés).
// 2) Key variables:
// - `GameDifficultyLevel` : trois crans stables (`easy` / `medium` / `hard`).
// - Constantes de hasard : moyen = part d’exploration ; difficile = imperfection volontaire (pas d’IA « parfaite »).
// 3) Logic flow:
// - Chaque jeu importe le type + les helpers ; l’algo « dur » combine optimalité + `rollHardSuboptimalMove()`.

export type GameDifficultyLevel = 'easy' | 'medium' | 'hard';

/** Part des coups du niveau moyen joués au hasard (avant toute heuristique spécifique au jeu). */
export const MEDIUM_DIFFICULTY_RANDOM_MOVE_CHANCE = 0.35;

/**
 * Probabilité qu’un niveau difficile évite le coup strictement le meilleur (score dominant).
 * Réduit l’effet « mur » tout en restant très fort ; les jeux peuvent combiner avec d’autres nuances.
 */
export const HARD_DIFFICULTY_SUBOPTIMAL_MOVE_CHANCE = 0.14;

// 1) Purpose: tirage pour un coup moyen « bruité » (exploration).
// 2) Key variables: `MEDIUM_DIFFICULTY_RANDOM_MOVE_CHANCE`.
// 3) Logic flow: `Math.random()` une fois par décision de coup.
export function rollMediumRandomMove(): boolean {
  return Math.random() < MEDIUM_DIFFICULTY_RANDOM_MOVE_CHANCE;
}

// 1) Purpose: tirage pour qu’un mode difficile choisisse un coup sous-optimal quand le jeu le supporte.
// 2) Key variables: `HARD_DIFFICULTY_SUBOPTIMAL_MOVE_CHANCE`.
// 3) Logic flow: vrai → le jeu doit préférer un coup non maximal parmi les options scorées.
export function rollHardSuboptimalMove(): boolean {
  return Math.random() < HARD_DIFFICULTY_SUBOPTIMAL_MOVE_CHANCE;
}
