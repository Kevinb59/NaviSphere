import type { GameDifficultyLevel } from './gameDifficulty';
import { rollHardSuboptimalMove, rollMediumRandomMove } from './gameDifficulty';

export const CF_ROWS = 6;
export const CF_COLS = 7;

export type CFPlayer = 'R' | 'Y';
export type CFCell = CFPlayer | null;
export type CFBoard = CFCell[][];

export type CFOutcome =
  | { type: 'playing' }
  | { type: 'win'; player: CFPlayer; line: [number, number][] }
  | { type: 'draw' };

const WIN_SCORE = 1_000_000;
/** Profondeur de recherche (demi-coups) pour le niveau difficile — compromis perf / qualité. */
const HARD_SEARCH_PLIES = 6;

// 1) Purpose: plateau 6×7 vide (ligne 0 = haut de la grille à l’écran).
// 2) Key variables: `CF_ROWS` × `CF_COLS`.
// 3) Logic flow: chaque ligne est un tableau de cellules `null` | `R` | `Y`.
export function cfEmptyBoard(): CFBoard {
  return Array.from({ length: CF_ROWS }, () => Array.from({ length: CF_COLS }, () => null as CFCell));
}

// 1) Purpose: alternance des coups — les rouges commencent.
// 2) Key variables: décompte des jetons R et Y.
// 3) Logic flow: égalité → tour du rouge ; sinon tour du jaune.
export function cfNextPlayer(board: CFBoard): CFPlayer {
  let nr = 0;
  let ny = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'R') nr += 1;
      else if (cell === 'Y') ny += 1;
    }
  }
  return nr === ny ? 'R' : 'Y';
}

function other(p: CFPlayer): CFPlayer {
  return p === 'R' ? 'Y' : 'R';
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// 1) Purpose: ligne d’atterrissage du prochain jeton dans la colonne `col` (du bas vers le haut).
// 2) Key variables: indice de ligne `r` croissant vers le bas visuel (index 5 = bas).
// 3) Logic flow: de `CF_ROWS-1` à `0`, première case vide.
export function cfGetLandingRow(board: CFBoard, col: number): number | null {
  for (let r = CF_ROWS - 1; r >= 0; r -= 1) {
    if (board[r]![col] === null) return r;
  }
  return null;
}

// 1) Purpose: colonnes où un coup est encore possible.
// 2) Key variables: indices 0…6.
// 3) Logic flow: `cfGetLandingRow` non nul.
export function cfLegalColumns(board: CFBoard): number[] {
  const cols: number[] = [];
  for (let c = 0; c < CF_COLS; c += 1) {
    if (cfGetLandingRow(board, c) !== null) cols.push(c);
  }
  return cols;
}

// 1) Purpose: copie profonde pour simulations (IA, minimax).
// 2) Key variables: nouvelle grille indépendante.
// 3) Logic flow: `map` sur chaque ligne.
export function cfCloneBoard(board: CFBoard): CFBoard {
  return board.map((row) => [...row]);
}

// 1) Purpose: appliquer un coup dans `col` pour `player` ; `null` si colonne pleine.
// 2) Key variables: `cfGetLandingRow`, copie de plateau.
// 3) Logic flow: pose le jeton à la ligne d’atterrissage.
export function cfApplyMove(board: CFBoard, col: number, player: CFPlayer): CFBoard | null {
  const r = cfGetLandingRow(board, col);
  if (r === null) return null;
  const next = cfCloneBoard(board);
  next[r]![col] = player;
  return next;
}

// 1) Purpose: longueur d’alignement en `(dr,dc)` à partir de `(r,c)` pour le joueur `p`.
// 2) Key variables: comptage bidirectionnel.
// 3) Logic flow: extension dans les deux sens le long du vecteur directeur.
function cfLineLength(board: CFBoard, r: number, c: number, dr: number, dc: number, p: CFPlayer): number {
  let len = 1;
  let cr = r + dr;
  let cc = c + dc;
  while (cr >= 0 && cr < CF_ROWS && cc >= 0 && cc < CF_COLS && board[cr]![cc] === p) {
    len += 1;
    cr += dr;
    cc += dc;
  }
  cr = r - dr;
  cc = c - dc;
  while (cr >= 0 && cr < CF_ROWS && cc >= 0 && cc < CF_COLS && board[cr]![cc] === p) {
    len += 1;
    cr -= dr;
    cc -= dc;
  }
  return len;
}

// 1) Purpose: détecter un gagnant s’il existe.
// 2) Key variables: 4 directions orthogonales / diagonales.
// 3) Logic flow: pour chaque jeton, longueur ≥ 4 → gagnant.
export function cfGetWinner(board: CFBoard): CFPlayer | null {
  const dirs: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < CF_ROWS; r += 1) {
    for (let c = 0; c < CF_COLS; c += 1) {
      const p = board[r]![c];
      if (p === null) continue;
      for (const [dr, dc] of dirs) {
        if (cfLineLength(board, r, c, dr, dc, p) >= 4) return p;
      }
    }
  }
  return null;
}

// 1) Purpose: coordonnées exactes des 4 cases gagnantes (surlignage UI).
// 2) Key variables: fenêtres glissantes de taille 4 sur toutes les directions.
// 3) Logic flow: première fenêtre homogène non vide → retour des 4 paires.
export function cfGetWinningLine(board: CFBoard): [number, number][] | null {
  for (let r = 0; r < CF_ROWS; r += 1) {
    for (let c = 0; c <= CF_COLS - 4; c += 1) {
      const p = board[r]![c];
      if (
        p !== null &&
        p === board[r]![c + 1] &&
        p === board[r]![c + 2] &&
        p === board[r]![c + 3]
      ) {
        return [
          [r, c],
          [r, c + 1],
          [r, c + 2],
          [r, c + 3],
        ];
      }
    }
  }
  for (let c = 0; c < CF_COLS; c += 1) {
    for (let r = 0; r <= CF_ROWS - 4; r += 1) {
      const p = board[r]![c];
      if (
        p !== null &&
        p === board[r + 1]![c] &&
        p === board[r + 2]![c] &&
        p === board[r + 3]![c]
      ) {
        return [
          [r, c],
          [r + 1, c],
          [r + 2, c],
          [r + 3, c],
        ];
      }
    }
  }
  for (let r = 0; r <= CF_ROWS - 4; r += 1) {
    for (let c = 0; c <= CF_COLS - 4; c += 1) {
      const p = board[r]![c];
      if (
        p !== null &&
        p === board[r + 1]![c + 1] &&
        p === board[r + 2]![c + 2] &&
        p === board[r + 3]![c + 3]
      ) {
        return [
          [r, c],
          [r + 1, c + 1],
          [r + 2, c + 2],
          [r + 3, c + 3],
        ];
      }
    }
  }
  for (let r = 0; r <= CF_ROWS - 4; r += 1) {
    for (let c = 0; c <= CF_COLS - 4; c += 1) {
      const p = board[r]![c + 3];
      if (
        p !== null &&
        p === board[r + 1]![c + 2] &&
        p === board[r + 2]![c + 1] &&
        p === board[r + 3]![c]
      ) {
        return [
          [r, c + 3],
          [r + 1, c + 2],
          [r + 2, c + 1],
          [r + 3, c],
        ];
      }
    }
  }
  return null;
}

// 1) Purpose: plateau sans coup légal et sans gagnant.
// 2) Key variables: `cfLegalColumns`.
// 3) Logic flow: longueur 0.
export function cfBoardFull(board: CFBoard): boolean {
  return cfLegalColumns(board).length === 0;
}

// 1) Purpose: état de partie pour l’interface (en cours, victoire avec ligne, nul).
// 2) Key variables: `cfGetWinner`, `cfGetWinningLine`, `cfBoardFull`.
// 3) Logic flow: victoire → ligne affichable ; sinon match nul si plein.
export function cfOutcome(board: CFBoard): CFOutcome {
  const w = cfGetWinner(board);
  if (w !== null) {
    const line = cfGetWinningLine(board) ?? [];
    return { type: 'win', player: w, line };
  }
  if (cfBoardFull(board)) return { type: 'draw' };
  return { type: 'playing' };
}

// 1) Purpose: score d’une fenêtre de 4 cases pour l’heuristique (menaces / blocages).
// 2) Key variables: comptage jetons `ai` vs `opp` ; les deux présents → 0.
// 3) Logic flow: pondération croissante avec le nombre de jetons alignables.
function cfScoreWindow(a: CFCell, b: CFCell, c: CFCell, d: CFCell, ai: CFPlayer, opp: CFPlayer): number {
  const w: CFCell[] = [a, b, c, d];
  const aiC = w.filter((x) => x === ai).length;
  const opC = w.filter((x) => x === opp).length;
  if (aiC > 0 && opC > 0) return 0;
  if (aiC === 4) return 10_000;
  if (opC === 4) return -10_000;
  if (aiC === 3 && opC === 0) return 85;
  if (opC === 3 && aiC === 0) return -85;
  if (aiC === 2 && opC === 0) return 10;
  if (opC === 2 && aiC === 0) return -10;
  if (aiC === 1 && opC === 0) return 2;
  if (opC === 1 && aiC === 0) return -2;
  return 0;
}

// 1) Purpose: évaluation statique du plateau du point de vue de `ai` (feuilles du minimax).
// 2) Key variables: toutes les fenêtres 4 cases + léger bonus colonnes centrales.
// 3) Logic flow: somme des `cfScoreWindow` + positionnel.
function cfEvaluateBoard(board: CFBoard, ai: CFPlayer): number {
  const opp = other(ai);
  let score = 0;
  for (let r = 0; r < CF_ROWS; r += 1) {
    for (let c = 0; c <= CF_COLS - 4; c += 1) {
      score += cfScoreWindow(
        board[r]![c],
        board[r]![c + 1],
        board[r]![c + 2],
        board[r]![c + 3],
        ai,
        opp,
      );
    }
  }
  for (let c = 0; c < CF_COLS; c += 1) {
    for (let r = 0; r <= CF_ROWS - 4; r += 1) {
      score += cfScoreWindow(
        board[r]![c],
        board[r + 1]![c],
        board[r + 2]![c],
        board[r + 3]![c],
        ai,
        opp,
      );
    }
  }
  for (let r = 0; r <= CF_ROWS - 4; r += 1) {
    for (let c = 0; c <= CF_COLS - 4; c += 1) {
      score += cfScoreWindow(
        board[r]![c],
        board[r + 1]![c + 1],
        board[r + 2]![c + 2],
        board[r + 3]![c + 3],
        ai,
        opp,
      );
    }
  }
  for (let r = 0; r <= CF_ROWS - 4; r += 1) {
    for (let c = 0; c <= CF_COLS - 4; c += 1) {
      score += cfScoreWindow(
        board[r]![c + 3],
        board[r + 1]![c + 2],
        board[r + 2]![c + 1],
        board[r + 3]![c],
        ai,
        opp,
      );
    }
  }
  const center = (CF_COLS - 1) / 2;
  for (let r = 0; r < CF_ROWS; r += 1) {
    for (let c = 0; c < CF_COLS; c += 1) {
      const w = (CF_COLS / 2 - Math.abs(c - center)) * 0.2;
      if (board[r]![c] === ai) score += w;
      else if (board[r]![c] === opp) score -= w;
    }
  }
  return score;
}

// 1) Purpose: ordonner les colonnes pour l’alpha-bêta (centre d’abord).
// 2) Key variables: permutation `[3,4,2,5,1,6,0]`.
// 3) Logic flow: filtre sur les coups légaux uniquement.
function cfOrderCols(legal: number[]): number[] {
  const pref = [3, 4, 2, 5, 1, 6, 0];
  const set = new Set(legal);
  return pref.filter((c) => set.has(c));
}

// 1) Purpose: minimax avec élagage alpha-bêta et profondeur plafonnée.
// 2) Key variables: `ai` maximise, `current` est le joueur qui doit jouer sur ce nœud.
// 3) Logic flow: terminaux (victoire / nul) → scores ±WIN_SCORE ; feuille → `cfEvaluateBoard`.
function cfMinimax(
  board: CFBoard,
  depth: number,
  alpha: number,
  beta: number,
  ai: CFPlayer,
  current: CFPlayer,
): number {
  const oppAi = other(ai);
  const w = cfGetWinner(board);
  if (w === ai) return WIN_SCORE;
  if (w === oppAi) return -WIN_SCORE;
  if (cfBoardFull(board)) return 0;
  if (depth === 0) return cfEvaluateBoard(board, ai);

  const moves = cfOrderCols(cfLegalColumns(board));
  if (current === ai) {
    let maxEv = -Infinity;
    for (const col of moves) {
      const nb = cfApplyMove(board, col, current);
      if (!nb) continue;
      const ev = cfMinimax(nb, depth - 1, alpha, beta, ai, oppAi);
      maxEv = Math.max(maxEv, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEv;
  }
  let minEv = Infinity;
  for (const col of moves) {
    const nb = cfApplyMove(board, col, current);
    if (!nb) continue;
    const ev = cfMinimax(nb, depth - 1, alpha, beta, ai, oppAi);
    minEv = Math.min(minEv, ev);
    beta = Math.min(beta, ev);
    if (beta <= alpha) break;
  }
  return minEv;
}

// 1) Purpose: heuristique « moyen » — gagne / bloque puis colonnes centrales.
// 2) Key variables: `rollMediumRandomMove`, simulations `cfApplyMove`.
// 3) Logic flow: aléatoire global ; sinon victoire immédiate ; blocage ; ordre préféré.
function cfMediumMove(board: CFBoard, ai: CFPlayer, human: CFPlayer): number {
  const legal = cfLegalColumns(board);
  if (legal.length === 0) return -1;
  if (rollMediumRandomMove()) return randomPick(legal);

  for (const col of cfOrderCols(legal)) {
    const nb = cfApplyMove(board, col, ai);
    if (nb && cfGetWinner(nb) === ai) return col;
  }
  for (const col of cfOrderCols(legal)) {
    const nb = cfApplyMove(board, col, human);
    if (nb && cfGetWinner(nb) === human) return col;
  }

  const ordered = cfOrderCols(legal);
  return ordered[0]!;
}

// 1) Purpose: niveau difficile — minimax borné + coup parfois sous-optimal (`rollHardSuboptimalMove`).
// 2) Key variables: `HARD_SEARCH_PLIES`, scores par colonne à la racine.
// 3) Logic flow: victoire immédiate prioritaire ; sinon tri des scores ; imperfection optionnelle.
function cfHardMove(board: CFBoard, ai: CFPlayer): number {
  const human = other(ai);
  const legal = cfLegalColumns(board);
  if (legal.length === 0) return -1;

  const ranked = cfOrderCols(legal).map((col) => {
    const nb = cfApplyMove(board, col, ai);
    if (!nb) return { col, score: -Infinity };
    if (cfGetWinner(nb) === ai) return { col, score: WIN_SCORE + 1 };
    const s = cfMinimax(nb, HARD_SEARCH_PLIES - 1, -Infinity, Infinity, ai, human);
    return { col, score: s };
  });
  ranked.sort((a, b) => b.score - a.score);
  const top = ranked[0]!.score;
  const strictlyWorse = ranked.filter((x) => x.score < top);
  if (rollHardSuboptimalMove() && strictlyWorse.length > 0) {
    return randomPick(strictlyWorse).col;
  }
  const amongBest = ranked.filter((x) => x.score === top);
  return randomPick(amongBest).col;
}

// 1) Purpose: coup de la Tesla (jaune) selon `GameDifficultyLevel` partagé.
// 2) Key variables: `ai` = jaune `Y`, humain = rouge `R` en mode vs IA.
// 3) Logic flow: facile aléatoire ; moyen heuristique ; dur minimax + imperfection.
export function cfAiChooseMove(board: CFBoard, difficulty: GameDifficultyLevel): number {
  const ai: CFPlayer = 'Y';
  const human: CFPlayer = 'R';
  const legal = cfLegalColumns(board);
  if (legal.length === 0) return -1;
  if (difficulty === 'easy') return randomPick(legal);
  if (difficulty === 'medium') return cfMediumMove(board, ai, human);
  return cfHardMove(board, ai);
}
