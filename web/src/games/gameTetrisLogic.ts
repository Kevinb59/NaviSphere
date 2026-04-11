// 1) Purpose:
// - Moteur Tetris aligné sur le dépôt html-css-javascript-games (formes, rotation (dx,dy)→(-dy,dx), pièce O fixe).
// 2) Key variables:
// - Grille 10×20 ; `TetId` pour couleurs ; `Piece` = id + rotation + position d’ancrage.
// 3) Logic flow:
// - Collisions, fusion, effacement de lignes, score / niveau / vitesse ; sac 7 pièces mélangé.

export const TET_COLS = 10;
export const TET_ROWS = 20;

export const TETROMINO_IDS = ['T', 'I', 'L', 'J', 'Z', 'S', 'O'] as const;
export type TetId = (typeof TETROMINO_IDS)[number];

export type TetCell = TetId | null;
export type TetBoard = TetCell[][];

export type Piece = {
  id: TetId;
  rot: number;
  x: number;
  y: number;
};

// 1) Purpose: formes de base (même offsets que 20-Tetris-Game/script.js, indice 0…6).
// 2) Key variables: coordonnées relatives à l’ancrage `(x,y)` du pivot logique.
// 3) Logic flow: rotation par pas de 90° via `rotateOffsets` sauf `O`.
export const BASE_SHAPES: Record<TetId, [number, number][]> = {
  T: [
    [-1, 1],
    [0, 1],
    [1, 1],
    [0, 0],
  ],
  I: [
    [-1, 0],
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  L: [
    [-1, -1],
    [-1, 0],
    [0, 0],
    [1, 0],
  ],
  J: [
    [1, -1],
    [-1, 0],
    [0, 0],
    [1, 0],
  ],
  Z: [
    [0, -1],
    [1, -1],
    [-1, 0],
    [0, 0],
  ],
  S: [
    [-1, -1],
    [0, -1],
    [0, 0],
    [1, 0],
  ],
  O: [
    [0, -1],
    [1, -1],
    [0, 0],
    [1, 0],
  ],
};

// 1) Purpose: rotation 90° (sens du jeu de référence).
// 2) Key variables: couple `(dx,dy)`.
// 3) Logic flow: `(dx,dy) → (-dy, dx)`.
export function rotateOffsets(cells: [number, number][]): [number, number][] {
  return cells.map(([dx, dy]) => [-dy, dx] as [number, number]);
}

// 1) Purpose: offsets courants après `rot` applications (0…3).
// 2) Key variables: `p.id`, `p.rot` ; `O` ne tourne pas.
// 3) Logic flow: copie de la base puis rotations répétées.
export function pieceOffsets(p: Piece): [number, number][] {
  let c = BASE_SHAPES[p.id];
  if (p.id === 'O') return c;
  for (let i = 0; i < p.rot % 4; i += 1) {
    c = rotateOffsets(c);
  }
  return c;
}

// 1) Purpose: coordonnées absolues des 4 blocs sur la grille.
// 2) Key variables: `p.x`, `p.y`, `pieceOffsets`.
// 3) Logic flow: translation de chaque offset.
export function pieceAbsoluteCells(p: Piece): [number, number][] {
  return pieceOffsets(p).map(([dx, dy]) => [p.x + dx, p.y + dy] as [number, number]);
}

// 1) Purpose: plateau vide.
// 2) Key variables: `TET_ROWS` × `TET_COLS`.
// 3) Logic flow: tableau de lignes de `null`.
export function tetEmptyBoard(): TetBoard {
  return Array.from({ length: TET_ROWS }, () => Array.from({ length: TET_COLS }, () => null as TetCell));
}

// 1) Purpose: test collision bords ou blocs fixes.
// 2) Key variables: `y < 0` autorisé (entrée en haut) ; `y >= ROWS` ou hors colonnes → collision.
// 3) Logic flow: parcourt les 4 cellules de la pièce.
export function tetCollides(board: TetBoard, p: Piece): boolean {
  for (const [dx, dy] of pieceOffsets(p)) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (x < 0 || x >= TET_COLS || y >= TET_ROWS) return true;
    if (y >= 0 && board[y]![x] !== null) return true;
  }
  return false;
}

// 1) Purpose: nouvelle pièce à la position de spawn (équivalent `spawnX`/`spawnY` du script source).
// 2) Key variables: centre horizontal ~4, `y` = 1.
// 3) Logic flow: `rot` = 0.
export function tetSpawnPiece(id: TetId): Piece {
  return { id, rot: 0, x: 4, y: 1 };
}

// 1) Purpose: translation si valide.
// 2) Key variables: `dx`, `dy` en cellules.
// 3) Logic flow: clone `Piece` + test `tetCollides`.
export function tetTryMove(board: TetBoard, p: Piece, dx: number, dy: number): Piece | null {
  const next: Piece = { ...p, x: p.x + dx, y: p.y + dy };
  if (tetCollides(board, next)) return null;
  return next;
}

const ROTATION_KICKS: [number, number][] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-1, -1],
  [1, -1],
  [0, 1],
  [-2, 0],
  [2, 0],
];

// 1) Purpose: rotation avec kicks mur simples (wall kick léger si besoin).
// 2) Key variables: `O` inchangée ; `rot + 1` mod 4.
// 3) Logic flow: essaie chaque décalage jusqu’à position libre.
export function tetTryRotate(board: TetBoard, p: Piece): Piece | null {
  if (p.id === 'O') return p;
  const newRot = (p.rot + 1) % 4;
  const base: Piece = { ...p, rot: newRot };
  for (const [kx, ky] of ROTATION_KICKS) {
    const test: Piece = { ...base, x: p.x + kx, y: p.y + ky };
    if (!tetCollides(board, test)) return test;
  }
  return null;
}

// 1) Purpose: chute instantanée jusqu’à la pile.
// 2) Key variables: incrémente `y` tant que pas de collision.
// 3) Logic flow: retourne la dernière position valide.
export function tetHardDrop(board: TetBoard, p: Piece): Piece {
  let cur = p;
  for (;;) {
    const n: Piece = { ...cur, y: cur.y + 1 };
    if (tetCollides(board, n)) return cur;
    cur = n;
  }
}

// 1) Purpose: figer la pièce dans le plateau.
// 2) Key variables: copie du `board`.
// 3) Logic flow: écrit `p.id` dans chaque case occupée (si dans les bornes visibles).
export function tetMergePiece(board: TetBoard, p: Piece): TetBoard {
  const nb: TetBoard = board.map((row) => [...row]);
  for (const [dx, dy] of pieceOffsets(p)) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (y >= 0 && y < TET_ROWS && x >= 0 && x < TET_COLS) {
      nb[y]![x] = p.id;
    }
  }
  return nb;
}

// 1) Purpose: supprimer les lignes complètes et faire descendre le reste.
// 2) Key variables: `cleared` = nombre de lignes.
// 3) Logic flow: filtre les lignes non pleines ; préfixe de lignes vides.
export function tetClearLines(board: TetBoard): { board: TetBoard; cleared: number } {
  const kept = board.filter((row) => !row.every((c) => c !== null));
  const cleared = TET_ROWS - kept.length;
  const emptyLine: TetCell[] = Array.from({ length: TET_COLS }, () => null);
  const next: TetBoard = [...kept];
  while (next.length < TET_ROWS) {
    next.unshift([...emptyLine]);
  }
  return { board: next, cleared };
}

// 1) Purpose: points selon lignes et niveau (inspiré scoring classique).
// 2) Key variables: multiplicateurs par 1/2/3/4 lignes.
// 3) Logic flow: `0` si aucune ligne.
export function tetLineScore(cleared: number, level: number): number {
  if (cleared <= 0) return 0;
  const table = [0, 100, 300, 500, 800];
  const mult = table[Math.min(cleared, 4)] ?? 800;
  return mult * Math.max(1, level);
}

// 1) Purpose: bonus léger pour pose de pièce (comme le script source `shape: true`).
// 2) Key variables: `level`.
// 3) Logic flow: fixe 5 × niveau.
export function tetDropBonus(level: number): number {
  return 5 * Math.max(1, level);
}

// 1) Purpose: seuil de score pour passer au niveau suivant.
// 2) Key variables: progression exponentielle simplifiée.
// 3) Logic flow: `1000 * 2^(level-1)`.
export function tetLevelTargetScore(level: number): number {
  return 1000 * 2 ** (level - 1);
}

// 1) Purpose: intervalle de gravité (ms) selon le niveau.
// 2) Key variables: plancher ~120 ms.
// 3) Logic flow: `700 - (level-1)*55`, minimum 120.
export function tetGravityMs(level: number): number {
  return Math.max(120, 700 - (level - 1) * 55);
}

// 1) Purpose: tirage suivant depuis un sac 7 pièces (Fisher–Yates comme le script source).
// 2) Key variables: file `bag` dans l’état React.
// 3) Logic flow: si sac vide → remplir et mélanger → `shift`.
export function tetRefillBag(): TetId[] {
  const bag = [...TETROMINO_IDS];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  return bag;
}

export function tetTakeNextFromBag(bag: TetId[]): { id: TetId; bag: TetId[] } {
  let b = bag;
  if (b.length === 0) b = tetRefillBag();
  const [id, ...rest] = b;
  return { id: id!, bag: rest };
}
