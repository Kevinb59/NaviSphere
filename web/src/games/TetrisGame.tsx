import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BASE_SHAPES,
  TET_COLS,
  TET_ROWS,
  type Piece,
  type TetBoard,
  type TetCell,
  type TetId,
  tetClearLines,
  tetCollides,
  tetDropBonus,
  tetEmptyBoard,
  tetGravityMs,
  tetHardDrop,
  tetLevelTargetScore,
  tetLineScore,
  tetMergePiece,
  tetRefillBag,
  tetSpawnPiece,
  tetTakeNextFromBag,
  tetTryMove,
  tetTryRotate,
  pieceAbsoluteCells,
} from './gameTetrisLogic';

const SWIPE_MIN_PX = 36;
const TAP_MAX_PX = 20;

const TET_STYLE: Record<TetId, string> = {
  I: 'bg-gradient-to-br from-cyan-200 via-cyan-400 to-cyan-800 shadow-[0_0_12px_rgba(34,211,238,0.55)] ring-1 ring-cyan-200/40',
  O: 'bg-gradient-to-br from-amber-100 via-amber-400 to-amber-700 shadow-[0_0_12px_rgba(250,204,21,0.45)] ring-1 ring-amber-200/35',
  T: 'bg-gradient-to-br from-fuchsia-300 via-purple-500 to-violet-900 shadow-[0_0_12px_rgba(232,121,249,0.45)] ring-1 ring-fuchsia-200/35',
  L: 'bg-gradient-to-br from-orange-200 via-orange-500 to-orange-900 shadow-[0_0_12px_rgba(251,146,60,0.45)] ring-1 ring-orange-200/35',
  J: 'bg-gradient-to-br from-blue-200 via-blue-500 to-indigo-900 shadow-[0_0_12px_rgba(96,165,250,0.45)] ring-1 ring-blue-200/35',
  Z: 'bg-gradient-to-br from-rose-200 via-rose-500 to-red-800 shadow-[0_0_12px_rgba(251,113,133,0.45)] ring-1 ring-rose-200/35',
  S: 'bg-gradient-to-br from-emerald-200 via-emerald-500 to-emerald-900 shadow-[0_0_12px_rgba(52,211,153,0.45)] ring-1 ring-emerald-200/35',
};

type GameState = {
  board: TetBoard;
  piece: Piece;
  nextId: TetId;
  bag: TetId[];
  score: number;
  level: number;
  lines: number;
  gameOver: boolean;
  paused: boolean;
};

// 1) Purpose: état initial + sac 7 pièces mélangé (logique type dépôt de référence).
// 2) Key variables: `t1.id` jouée, `t2.id` en aperçu « suivant », `bag` = reste du sac.
// 3) Logic flow: deux tirages consécutifs sans remélanger entre les deux.
function createInitialState(): GameState {
  const bag0 = tetRefillBag();
  const first = bag0[0]!;
  const second = bag0[1]!;
  const rest = bag0.slice(2);
  const board = tetEmptyBoard();
  const piece = tetSpawnPiece(first);
  return {
    board,
    piece,
    nextId: second,
    bag: rest,
    score: 0,
    level: 1,
    lines: 0,
    gameOver: tetCollides(board, piece),
    paused: false,
  };
}

// 1) Purpose: fusion, effacement de lignes, score, niveau, spawn suivant.
// 2) Key variables: `tetLineScore`, `tetDropBonus`, boucle `tetLevelTargetScore`.
// 3) Logic flow: collision au spawn → `gameOver`.
function lockAndSpawn(prev: GameState, locked: Piece): GameState {
  const b = tetMergePiece(prev.board, locked);
  const { board: b2, cleared } = tetClearLines(b);
  const linePts = tetLineScore(cleared, prev.level);
  const bonus = tetDropBonus(prev.level);
  let score = prev.score + linePts + bonus;
  let level = prev.level;
  while (score >= tetLevelTargetScore(level)) {
    level += 1;
  }
  const lines = prev.lines + cleared;
  const nextPiece = tetSpawnPiece(prev.nextId);
  const { id: newNextId, bag: newBag } = tetTakeNextFromBag(prev.bag);
  if (tetCollides(b2, nextPiece)) {
    return {
      ...prev,
      board: b2,
      piece: nextPiece,
      nextId: newNextId,
      bag: newBag,
      score,
      level,
      lines,
      gameOver: true,
    };
  }
  return {
    ...prev,
    board: b2,
    piece: nextPiece,
    nextId: newNextId,
    bag: newBag,
    score,
    level,
    lines,
  };
}

// 1) Purpose: grille d’affichage : pile figée + pièce active (pour surimpression couleurs).
// 2) Key variables: `Set` des cellules `(r,c)` occupées par la pièce courante.
// 3) Logic flow: priorité au live pour la couleur (même `TetId` que la pièce).
function buildDisplayBoard(board: TetBoard, piece: Piece | null): TetCell[][] {
  const g = board.map((row) => [...row]);
  if (!piece) return g;
  for (const [x, y] of pieceAbsoluteCells(piece)) {
    if (y >= 0 && y < TET_ROWS && x >= 0 && x < TET_COLS) {
      g[y]![x] = piece.id;
    }
  }
  return g;
}

// 1) Purpose: mini-grille 4×4 pour l’aperçu « suivant ».
// 2) Key variables: offsets de `BASE_SHAPES[id]` sans rotation.
// 3) Logic flow: translation pour centrer approximativement.
function NextPreview({ id }: { id: TetId }) {
  const raw = BASE_SHAPES[id];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [dx, dy] of raw) {
    minX = Math.min(minX, dx);
    minY = Math.min(minY, dy);
    maxX = Math.max(maxX, dx);
    maxY = Math.max(maxY, dy);
  }
  const ox = -minX;
  const oy = -minY;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const cells: boolean[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
  for (const [dx, dy] of raw) {
    cells[dy + oy]![dx + ox] = true;
  }
  return (
    <div
      className="grid gap-0.5 p-2"
      style={{ gridTemplateColumns: `repeat(${w}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {cells.flatMap((row, r) =>
        row.map((on, c) => (
          <div
            key={`${r}-${c}`}
            className={`aspect-square w-5 rounded-sm sm:w-6 ${on ? TET_STYLE[id] : 'bg-black/40 ring-1 ring-white/5'}`}
          />
        )),
      )}
    </div>
  );
}

// 1) Purpose: Tetris NaviSphere — gestes (swipe/tap) + flèches clavier, style néon.
// 2) Key variables: `game` état complet ; `pointerStartRef` pour classifier tap vs swipe.
// 3) Logic flow: gravité par `setInterval` ; entrées mutent `piece` ou `lockAndSpawn` (chute sèche).
export function TetrisGame() {
  const [game, setGame] = useState<GameState>(() => createInitialState());

  const playRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const reset = useCallback(() => {
    setGame(createInitialState());
  }, []);

  const togglePause = useCallback(() => {
    setGame((g) => (g.gameOver ? g : { ...g, paused: !g.paused }));
  }, []);

  const moveH = useCallback((dir: -1 | 1) => {
    setGame((g) => {
      if (g.gameOver || g.paused) return g;
      const np = tetTryMove(g.board, g.piece, dir, 0);
      return np ? { ...g, piece: np } : g;
    });
  }, []);

  const rotate = useCallback(() => {
    setGame((g) => {
      if (g.gameOver || g.paused) return g;
      const np = tetTryRotate(g.board, g.piece);
      return np ? { ...g, piece: np } : g;
    });
  }, []);

  const hardDropAction = useCallback(() => {
    setGame((g) => {
      if (g.gameOver || g.paused) return g;
      const landed = tetHardDrop(g.board, g.piece);
      return lockAndSpawn(g, landed);
    });
  }, []);

  // 4) Gravité automatique : soft drop d’une ligne ou verrouillage + spawn.
  //    Variables clés: `tetGravityMs(game.level)` ; pause / game over arrêtent l’intervalle.
  //    Flux: `setGame` fonctionnel pour éviter les closures obsolètes.
  useEffect(() => {
    if (game.gameOver || game.paused) return;
    const ms = tetGravityMs(game.level);
    const id = window.setInterval(() => {
      setGame((g) => {
        if (g.gameOver || g.paused) return g;
        const down = tetTryMove(g.board, g.piece, 0, 1);
        if (down) return { ...g, piece: down };
        return lockAndSpawn(g, g.piece);
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [game.gameOver, game.paused, game.level]);

  // 4) Focus clavier sur la zone de jeu à l’ouverture.
  //    Variables clés: `playRef`.
  //    Flux: `focus` une fois au montage (jeu dans panneau modale).
  useEffect(() => {
    playRef.current?.focus();
  }, []);

  // 4) Flèches : gauche/droite translation, bas chute sèche, haut rotation (PC).
  //    Variables clés: `preventDefault` pour ne pas faire défiler la page.
  //    Flux: `switch` sur `e.key`.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (game.gameOver) return;
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Escape'].includes(k)) {
        e.preventDefault();
      }
      if (k === 'Escape') {
        togglePause();
        return;
      }
      if (game.paused) return;
      if (k === 'ArrowLeft') moveH(-1);
      else if (k === 'ArrowRight') moveH(1);
      else if (k === 'ArrowDown') hardDropAction();
      else if (k === 'ArrowUp') rotate();
    },
    [game.gameOver, game.paused, moveH, rotate, hardDropAction, togglePause],
  );

  // 4) Pointer : ignorer les boutons ; petit déplacement = rotation ; grand = swipe.
  //    Variables clés: `SWIPE_MIN_PX`, `TAP_MAX_PX`, dominant `dx` vs `dy`.
  //    Flux: swipe bas → `hardDropAction` ; gauche/droite → `moveH`.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (!start || game.gameOver || game.paused) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const dist = Math.hypot(dx, dy);
      if (dist < TAP_MAX_PX) {
        rotate();
        return;
      }
      if (dist < SWIPE_MIN_PX) return;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx < 0) moveH(-1);
        else moveH(1);
      } else if (dy > 0) {
        hardDropAction();
      }
    },
    [game.gameOver, game.paused, rotate, moveH, hardDropAction],
  );

  const display = buildDisplayBoard(game.board, game.piece);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3" tabIndex={-1}>
      {/* 4) Bandeau scores + actions — `stopPropagation` évite de confondre avec les gestes plateau. */}
      <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2">
        <div className="shrink-0 rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-center backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">Score</p>
          <p className="text-base font-semibold tabular-nums text-white">{game.score}</p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-center backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">Niveau</p>
          <p className="text-base font-semibold tabular-nums text-sky-200/95">{game.level}</p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-center backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">Lignes</p>
          <p className="text-base font-semibold tabular-nums text-white">{game.lines}</p>
        </div>
        <button
          type="button"
          onClick={togglePause}
          disabled={game.gameOver}
          className="shrink-0 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/40 disabled:opacity-40 sm:px-4 sm:text-sm"
        >
          {game.paused ? 'Reprendre' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/40 sm:px-4 sm:text-sm"
        >
          Nouvelle partie
        </button>
      </div>

      <p className="shrink-0 px-1 text-center text-[11px] leading-snug text-white/50">
        Glissez : gauche / droite / bas (chute rapide). Tapez le plateau pour pivoter. Clavier : ← → ↓ et ↑
        pour tourner. Échap : pause.
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 overflow-auto p-1">
        {/* 4) Aperçu « Suivant » — cadre assorti au plateau. */}
        <div className="hidden shrink-0 flex-col items-center rounded-2xl border border-cyan-500/20 bg-black/35 p-2 ring-1 ring-white/10 sm:flex">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-200/70">Suivant</p>
          <NextPreview id={game.nextId} />
        </div>

        {/* 4) Zone interactive : `touch-action-none` pour les swipes propres sur mobile. */}
        <div
          ref={playRef}
          tabIndex={0}
          role="application"
          aria-label="Tetris — utilisez les gestes ou les flèches"
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="relative max-h-[min(72vh,640px)] w-full max-w-[min(92vw,360px)] touch-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          <div className="rounded-[20px] border border-cyan-400/30 bg-gradient-to-b from-slate-900/95 to-black/95 p-2 shadow-[0_0_40px_rgba(34,211,238,0.12)] ring-1 ring-white/10 sm:p-2.5">
            <div
              className="grid gap-0.5 sm:gap-1"
              style={{ gridTemplateColumns: `repeat(${TET_COLS}, minmax(0, 1fr))` }}
            >
              {display.map((row, r) =>
                row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    className={`aspect-square min-h-0 w-full rounded-[3px] sm:rounded-[4px] ${
                      cell
                        ? TET_STYLE[cell]
                        : 'bg-black/50 ring-1 ring-inset ring-cyan-950/40'
                    }`}
                  />
                )),
              )}
            </div>
          </div>

          {game.gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px] bg-black/70 p-4 text-center backdrop-blur-sm">
              <p className="text-lg font-semibold text-white">Partie terminée</p>
              <p className="mt-1 text-sm text-white/65">Score final : {game.score}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-5 rounded-[14px] border border-white/20 bg-white/[0.12] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.18]"
              >
                Rejouer
              </button>
            </div>
          )}

          {game.paused && !game.gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px] bg-black/55 p-4 text-center backdrop-blur-[3px]">
              <p className="text-lg font-semibold text-white">En pause</p>
              <button
                type="button"
                onClick={togglePause}
                className="mt-4 rounded-[14px] border border-white/20 bg-white/[0.12] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.18]"
              >
                Reprendre
              </button>
            </div>
          )}
        </div>

        {/* 4) Aperçu mobile sous le plateau (colonne unique). */}
        <div className="flex shrink-0 flex-col items-center rounded-2xl border border-cyan-500/20 bg-black/35 p-2 ring-1 ring-white/10 sm:hidden">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-200/70">Suivant</p>
          <NextPreview id={game.nextId} />
        </div>
      </div>
    </div>
  );
}
