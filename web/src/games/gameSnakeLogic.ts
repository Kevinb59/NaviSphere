// 1) Purpose:
// - Logique pure du Snake (grille, déplacements, nourriture, score) — inspirée des jeux canvas classiques.
// 2) Key variables: `GRID_SIZE` ; `Dir` ; segments `snake` comme liste tête → queue.
// 3) Logic flow: `step` avance d’une case ; `queueDirection` enregistre un prochain virage (pas de demi-tour).

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export const GRID_SIZE = 18;

export interface SnakeState {
  snake: Point[];
  direction: Dir;
  pendingDirection: Dir | null;
  food: Point;
  score: number;
  gameOver: boolean;
  paused: boolean;
}

// 1) Purpose: indiquer si deux directions sont opposées (interdit de faire demi-tour d’un coup).
// 2) Key variables: `a`, `b` ∈ Dir.
// 3) Logic flow: paires haut/bas et gauche/droite.
export function isOpposite(a: Dir, b: Dir): boolean {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

function randomFoodPosition(occupied: Set<string>): Point | null {
  const empties: Point[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const k = `${x},${y}`;
      if (!occupied.has(k)) empties.push({ x, y });
    }
  }
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)]!;
}

// 1) Purpose: état initial — serpent horizontal au centre, une pomme aléatoire.
// 2) Key variables: 3 segments pour démarrer lisiblement.
// 3) Logic flow: direction « right ».
export function createInitialSnakeState(): SnakeState {
  const mid = Math.floor(GRID_SIZE / 2);
  const snake: Point[] = [
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
    { x: mid - 3, y: mid },
  ];
  const occ = new Set(snake.map((p) => `${p.x},${p.y}`));
  const food = randomFoodPosition(occ) ?? { x: 0, y: 0 };
  return {
    snake,
    direction: 'right',
    pendingDirection: null,
    food,
    score: 0,
    gameOver: false,
    paused: false,
  };
}

function headOffset(head: Point, dir: Dir): Point {
  switch (dir) {
    case 'up':
      return { x: head.x, y: head.y - 1 };
    case 'down':
      return { x: head.x, y: head.y + 1 };
    case 'left':
      return { x: head.x - 1, y: head.y };
    case 'right':
      return { x: head.x + 1, y: head.y };
  }
}

// 1) Purpose: un tick de jeu — déplace la tête, allonge si pomme, sinon retire la queue.
// 2) Key variables: `effectiveDir` = `pendingDirection ?? direction` (après filtre demi-tour).
// 3) Logic flow: murs → collision avec le corps (queue exclue si pas de croissance) → nouvelle pomme si mangé.
export function stepSnake(state: SnakeState): SnakeState {
  if (state.gameOver || state.paused) return state;

  let dir: Dir = state.pendingDirection ?? state.direction;
  if (isOpposite(dir, state.direction)) {
    dir = state.direction;
  }

  const head = state.snake[0]!;
  const next = headOffset(head, dir);

  if (next.x < 0 || next.x >= GRID_SIZE || next.y < 0 || next.y >= GRID_SIZE) {
    return { ...state, gameOver: true, pendingDirection: null };
  }

  const ateFood = next.x === state.food.x && next.y === state.food.y;

  const bodyForCollision = ateFood ? state.snake : state.snake.slice(0, -1);
  const hitSelf = bodyForCollision.some((seg) => seg.x === next.x && seg.y === next.y);
  if (hitSelf) {
    return { ...state, gameOver: true, pendingDirection: null };
  }

  const newSnake = [next, ...state.snake];
  if (!ateFood) {
    newSnake.pop();
  }

  const occ = new Set(newSnake.map((p) => `${p.x},${p.y}`));
  const newScore = ateFood ? state.score + 10 : state.score;
  let newFood = state.food;
  let won = false;
  if (ateFood) {
    const nextFood = randomFoodPosition(occ);
    if (nextFood === null) {
      won = true;
    } else {
      newFood = nextFood;
    }
  }

  return {
    ...state,
    snake: newSnake,
    direction: dir,
    pendingDirection: null,
    food: newFood,
    score: newScore,
    gameOver: won,
  };
}

// 1) Purpose: enregistrer une direction depuis un swipe ou le clavier (un seul buffer par tick).
// 2) Key variables: rejet si demi-tour par rapport à `state.direction`.
// 3) Logic flow: met à jour `pendingDirection` pour le prochain `stepSnake`.
export function queueSnakeDirection(state: SnakeState, newDir: Dir): SnakeState {
  if (state.gameOver || state.paused) return state;
  if (isOpposite(newDir, state.direction)) return state;
  return { ...state, pendingDirection: newDir };
}

// 1) Purpose: vitesse en ms entre deux cases — accélère légèrement avec le score (comme les jeux canvas classiques).
// 2) Key variables: `score` pour paliers tous les 50 points.
// 3) Logic flow: plancher ~80 ms pour rester jouable.
export function tickMsForScore(score: number): number {
  const base = 150;
  const min = 80;
  const steps = Math.floor(score / 50);
  return Math.max(min, base - steps * 8);
}
