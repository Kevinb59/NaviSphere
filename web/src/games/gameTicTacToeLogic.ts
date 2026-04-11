export type Player = 'X' | 'O';

export type Board = (Player | null)[];

export const WIN_LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export type Outcome =
  | { type: 'ongoing' }
  | { type: 'win'; winner: Player; line: [number, number, number] }
  | { type: 'draw' };

// 1) Purpose: plateau vide 3×3 pour une nouvelle partie.
// 2) Key variables: 9 cases initialisées à `null`.
// 3) Logic flow: tableau fixe réutilisé par copie dans les coups / l’IA.
export function emptyBoard(): Board {
  return Array.from({ length: 9 }, () => null as Player | null);
}

// 1) Purpose: déterminer qui doit jouer selon la règle « X commence ».
// 2) Key variables: comptage des X et des O sur le plateau.
// 3) Logic flow: si égalité → prochain X ; sinon → prochain O.
export function nextPlayer(board: Board): Player {
  const nX = board.filter((c) => c === 'X').length;
  const nO = board.filter((c) => c === 'O').length;
  return nX === nO ? 'X' : 'O';
}

// 1) Purpose: victoire (ligne complète), match nul, ou partie en cours.
// 2) Key variables: `WIN_LINES` pour les 8 alignements possibles.
// 3) Logic flow: parcourt les lignes → gagnant ; sinon plateau plein → nul ; sinon ongoing.
export function outcome(board: Board): Outcome {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const p = board[a];
    if (p !== null && p === board[b] && p === board[c]) {
      return { type: 'win', winner: p, line };
    }
  }
  if (board.every((c) => c !== null)) return { type: 'draw' };
  return { type: 'ongoing' };
}

// 1) Purpose: indices des cases encore jouables (pour IA et coups aléatoires).
// 2) Key variables: filtre sur `board[i] === null`.
// 3) Logic flow: map + filter pour liste stable d’entiers 0…8.
export function emptyIndices(board: Board): number[] {
  return board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export type AiDifficulty = 'easy' | 'medium' | 'hard';

// 1) Purpose: coup gagnant immédiat pour `player` s’il existe.
// 2) Key variables: chaque case vide testée par simulation locale.
// 3) Logic flow: pose `player` → `outcome` win ? → retour index ; sinon `null`.
function winningIndex(board: Board, player: Player): number | null {
  for (const i of emptyIndices(board)) {
    const b = board.slice() as Board;
    b[i] = player;
    const o = outcome(b);
    if (o.type === 'win' && o.winner === player) return i;
  }
  return null;
}

// 1) Purpose: stratégie « Tesla » intermédiaire — priorité gagnant / blocage / centre / coins.
// 2) Key variables: `ai` = O, `human` = X (aligné sur le composant UI).
// 3) Logic flow: win → block → case 4 → coin aléatoire → sinon case libre aléatoire.
function heuristicMove(board: Board, ai: Player, human: Player): number {
  const win = winningIndex(board, ai);
  if (win !== null) return win;
  const block = winningIndex(board, human);
  if (block !== null) return block;
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0) return randomPick(corners);
  return randomPick(emptyIndices(board));
}

// 1) Purpose: score terminal pour minimax (+1 victoire IA, -1 adversaire, 0 nul).
// 2) Key variables: `ai` pour savoir si le gagnant est le joueur qu’on maximise.
// 3) Logic flow: `outcome` → nombre ou `null` si la partie continue.
function scoreTerminal(board: Board, ai: Player): number | null {
  const o = outcome(board);
  if (o.type === 'win') return o.winner === ai ? 1 : -1;
  if (o.type === 'draw') return 0;
  return null;
}

// 1) Purpose: récursion minimax depuis l’état `b` (tour lu via `nextPlayer`).
// 2) Key variables: `ai` maximise, l’autre joueur minimise.
// 3) Logic flow: terminal → score ; sinon branche tous les coups du joueur courant → max ou min.
function minimaxScore(board: Board, ai: Player): number {
  const term = scoreTerminal(board, ai);
  if (term !== null) return term;
  const player = nextPlayer(board);
  const moves = emptyIndices(board);
  const maximizing = player === ai;
  if (maximizing) {
    let best = -Infinity;
    for (const i of moves) {
      const nb = board.slice() as Board;
      nb[i] = player;
      best = Math.max(best, minimaxScore(nb, ai));
    }
    return best;
  }
  let best = Infinity;
  for (const i of moves) {
    const nb = board.slice() as Board;
    nb[i] = player;
    best = Math.min(best, minimaxScore(nb, ai));
  }
  return best;
}

// 1) Purpose: meilleur coup pour l’IA (O) par minimax — partie parfaite au morpion.
// 2) Key variables: évaluation de chaque case vide pour le tour de l’IA.
// 3) Logic flow: simule O sur chaque `i` → score minimax du résultat → argmax.
function minimaxBestMove(board: Board, ai: Player): number {
  const moves = emptyIndices(board);
  let bestMove = moves[0]!;
  let bestScore = -Infinity;
  for (const i of moves) {
    const nb = board.slice() as Board;
    nb[i] = ai;
    const s = minimaxScore(nb, ai);
    if (s > bestScore) {
      bestScore = s;
      bestMove = i;
    }
  }
  return bestMove;
}

// 1) Purpose: choisir l’index du coup de la Tesla selon la difficulté.
// 2) Key variables: `easy` aléatoire pur ; `medium` mélange aléatoire + heuristique ; `hard` minimax.
// 3) Logic flow: humain = X, IA = O ; retourne -1 si aucune case libre.
export function aiChooseMove(board: Board, difficulty: AiDifficulty): number {
  const human: Player = 'X';
  const ai: Player = 'O';
  const empties = emptyIndices(board);
  if (empties.length === 0) return -1;

  if (difficulty === 'easy') {
    return randomPick(empties);
  }

  if (difficulty === 'medium') {
    if (Math.random() < 0.35) return randomPick(empties);
    return heuristicMove(board, ai, human);
  }

  return minimaxBestMove(board, ai);
}
