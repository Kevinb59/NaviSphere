import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GRID_SIZE,
  addRandomTile,
  type Grid,
  hasAvailableMoves,
  hasWon,
  initialGridWithTwoTiles,
  moveDown,
  moveLeft,
  moveRight,
  moveUp,
} from './game2048Logic';

// 1) Purpose:
// - Couleurs des tuiles (thème proche du 2048 classique, lisible sur fond sombre NaviSphere).
// 2) Key variables: `v` = valeur affichée (puissance de 2).
// 3) Logic flow: classes Tailwind par palier jusqu’à 2048+.
function tileClassName(v: number): string {
  if (v <= 4) return 'bg-slate-200 text-slate-900';
  if (v <= 16) return 'bg-amber-200 text-amber-950';
  if (v <= 64) return 'bg-orange-300 text-orange-950';
  if (v <= 256) return 'bg-orange-500 text-white';
  if (v <= 1024) return 'bg-amber-500 text-white text-[clamp(14px,4vw,22px)]';
  return 'bg-yellow-400 text-amber-950 text-[clamp(13px,3.5vw,20px)] font-bold';
}

type MoveDir = 'up' | 'down' | 'left' | 'right';

// 1) Purpose:
// - 2048 compact, centré : grille 4×4 + scores + nouvelle partie ; le fond NaviSphere reste visible autour.
// 2) Key variables: `grid`, `score`, `best` (localStorage), `gameOver`, `wonBanner`.
// 3) Logic flow: entrée → `applyMove` → tuile aléatoire → fin de partie / bannière victoire.
export function Game2048() {
  const [grid, setGrid] = useState<Grid>(() => initialGridWithTwoTiles());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      const raw = localStorage.getItem('navisphere-2048-best');
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [gameOver, setGameOver] = useState(false);
  const [wonBanner, setWonBanner] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const gameOverRef = useRef(false);
  const winDismissedRef = useRef(false);
  const gridRef = useRef<Grid>(grid);
  const scoreRef = useRef(0);

  gridRef.current = grid;
  scoreRef.current = score;
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  const applyMove = useCallback((dir: MoveDir) => {
    // 4) Bloc mouvement: lecture grille courante → fonction `move*` → si mouvement effectif, tuile aléatoire + score + fin partie.
    //    Variables clés: `result` (grille intermédiaire, `moved`, `scoreAdded`), `next` après `addRandomTile`.
    //    Flux: refus si partie finie ; pas de déplacement possible → éventuel game over si grille bloquée.
    if (gameOverRef.current) return;
    const prev = gridRef.current;
    const result =
      dir === 'left'
        ? moveLeft(prev)
        : dir === 'right'
          ? moveRight(prev)
          : dir === 'up'
            ? moveUp(prev)
            : moveDown(prev);
    if (!result.moved) {
      if (!hasAvailableMoves(prev)) setGameOver(true);
      return;
    }
    const next = addRandomTile(result.grid);
    const nextScore = scoreRef.current + result.scoreAdded;
    setGrid(next);
    setScore(nextScore);
    setBest((prevB) => {
      if (nextScore <= prevB) return prevB;
      try {
        localStorage.setItem('navisphere-2048-best', String(nextScore));
      } catch {
        /* stockage indisponible */
      }
      return nextScore;
    });
    if (hasWon(next) && !winDismissedRef.current) setWonBanner(true);
    if (!hasAvailableMoves(next)) setGameOver(true);
  }, []);

  const resetGame = useCallback(() => {
    const g = initialGridWithTwoTiles();
    setGrid(g);
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    setWonBanner(false);
    winDismissedRef.current = false;
  }, []);

  const dismissWin = useCallback(() => {
    setWonBanner(false);
    winDismissedRef.current = true;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        applyMove('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        applyMove('up');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        applyMove('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        applyMove('right');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyMove]);

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const min = 28;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > min) {
      applyMove(dx > 0 ? 'right' : 'left');
    } else if (Math.abs(dy) > min) {
      applyMove(dy > 0 ? 'down' : 'up');
    }
    setTouchStart(null);
  };

  return (
    <div
      className="flex w-full max-w-[min(92vw,340px)] flex-col items-center gap-3"
      role="region"
      aria-label="2048"
    >
      {/* 4) Scores : petits panneaux vitrés ; pas de grand cadre autour du jeu pour laisser voir le starfield. */}
      <div className="flex w-full gap-2">
        <div className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-center backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-widest text-white/50">Score</p>
          <p className="text-base font-semibold tabular-nums text-white">{score}</p>
        </div>
        <div className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-center backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-widest text-white/50">Meilleur</p>
          <p className="text-base font-semibold tabular-nums text-amber-200/90">{best}</p>
        </div>
      </div>

      <div
        className="relative w-full touch-none select-none rounded-2xl border border-white/12 bg-black/25 p-2 backdrop-blur-[6px]"
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) setTouchStart({ x: t.clientX, y: t.clientY });
        }}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="mx-auto grid aspect-square w-full max-w-[300px] grid-cols-4 gap-1.5 sm:gap-2"
          style={{ touchAction: 'none' }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
            const r = Math.floor(i / GRID_SIZE);
            const c = i % GRID_SIZE;
            const v = grid[r]![c];
            return (
              <div
                key={`cell-${r}-${c}`}
                className="flex aspect-square items-center justify-center rounded-lg bg-white/[0.07] text-xs font-bold text-white/45"
              >
                {v === null ? (
                  ''
                ) : (
                  <span
                    className={`flex h-full w-full items-center justify-center rounded-lg ${tileClassName(v)}`}
                  >
                    {v}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {wonBanner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/60 p-4 text-center backdrop-blur-sm">
            <p className="text-lg font-semibold text-white">Bravo — 2048 !</p>
            <button
              type="button"
              onClick={dismissWin}
              className="mt-3 rounded-xl border border-white/20 bg-white/[0.12] px-4 py-2 text-sm text-white transition hover:bg-white/[0.18]"
            >
              Continuer
            </button>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/65 p-4 text-center backdrop-blur-sm">
            <p className="text-lg font-semibold text-white">Partie terminée</p>
            <button
              type="button"
              onClick={resetGame}
              className="mt-3 rounded-xl border border-white/20 bg-white/[0.12] px-4 py-2 text-sm text-white transition hover:bg-white/[0.18]"
            >
              Rejouer
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={resetGame}
        className="w-full rounded-xl border border-white/18 bg-black/35 px-3 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/45"
      >
        Nouvelle partie
      </button>
    </div>
  );
}
