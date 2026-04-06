// 1) Purpose:
// - Logique pure du puzzle 2048 (grille 4×4, fusions, score) — alignée sur le comportement du jeu original MIT.
// 2) Key variables: `SIZE` = 4 ; `Cell` = puissance de 2 ou vide.
// 3) Logic flow: mouvements via translation / transposition ; pas de dépendance React.

export type Cell = number | null;
export type Grid = Cell[][];

export const GRID_SIZE = 4;

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null) as Cell[]);
}

export function cloneGrid(g: Grid): Grid {
  return g.map((row) => [...row]);
}

function randomEmptyPosition(g: Grid): [number, number] | null {
  const empties: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (g[r]![c] === null) empties.push([r, c]);
    }
  }
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)]!;
}

export function addRandomTile(grid: Grid): Grid {
  const next = cloneGrid(grid);
  const pos = randomEmptyPosition(next);
  if (!pos) return next;
  const [r, c] = pos;
  next[r]![c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

export function initialGridWithTwoTiles(): Grid {
  let g = createEmptyGrid();
  g = addRandomTile(g);
  g = addRandomTile(g);
  return g;
}

function slideAndMergeRow(row: Cell[]): { row: Cell[]; score: number } {
  const nums = row.filter((x): x is number => x !== null);
  const merged: number[] = [];
  let score = 0;
  let i = 0;
  while (i < nums.length) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const v = nums[i]! * 2;
      merged.push(v);
      score += v;
      i += 2;
    } else {
      merged.push(nums[i]!);
      i += 1;
    }
  }
  const result: Cell[] = merged.map((n) => n as Cell);
  while (result.length < GRID_SIZE) result.push(null);
  return { row: result.slice(0, GRID_SIZE), score };
}

function rowsEqual(a: Cell[], b: Cell[]): boolean {
  return a.every((v, i) => v === b[i]);
}

export function moveLeft(grid: Grid): { grid: Grid; moved: boolean; scoreAdded: number } {
  let scoreAdded = 0;
  const newG = cloneGrid(grid);
  let moved = false;
  for (let r = 0; r < GRID_SIZE; r++) {
    const before = newG[r]!;
    const { row, score } = slideAndMergeRow(before);
    newG[r] = row;
    scoreAdded += score;
    if (!rowsEqual(before, row)) moved = true;
  }
  return { grid: newG, moved, scoreAdded };
}

function reverseRow(row: Cell[]): Cell[] {
  return [...row].reverse();
}

export function moveRight(grid: Grid): { grid: Grid; moved: boolean; scoreAdded: number } {
  const g = cloneGrid(grid);
  for (let r = 0; r < GRID_SIZE; r++) {
    g[r] = reverseRow(g[r]!);
  }
  const { grid: after, moved, scoreAdded } = moveLeft(g);
  for (let r = 0; r < GRID_SIZE; r++) {
    after[r] = reverseRow(after[r]!);
  }
  return { grid: after, moved, scoreAdded };
}

function transpose(g: Grid): Grid {
  return Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => g[c]![r]!),
  );
}

export function moveUp(grid: Grid): { grid: Grid; moved: boolean; scoreAdded: number } {
  const t = transpose(grid);
  const { grid: after, moved, scoreAdded } = moveLeft(t);
  return { grid: transpose(after), moved, scoreAdded };
}

export function moveDown(grid: Grid): { grid: Grid; moved: boolean; scoreAdded: number } {
  const t = transpose(grid);
  const { grid: after, moved, scoreAdded } = moveRight(t);
  return { grid: transpose(after), moved, scoreAdded };
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r]![c] !== b[r]![c]) return false;
    }
  }
  return true;
}

export function hasAvailableMoves(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r]![c] === null) return true;
      const v = grid[r]![c];
      if (c < GRID_SIZE - 1 && grid[r]![c + 1] === v) return true;
      if (r < GRID_SIZE - 1 && grid[r + 1]![c] === v) return true;
    }
  }
  return false;
}

export function hasWon(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r]![c] === 2048) return true;
    }
  }
  return false;
}
