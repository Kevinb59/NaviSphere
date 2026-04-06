import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GRID_SIZE,
  type Dir,
  type SnakeState,
  createInitialSnakeState,
  queueSnakeDirection,
  stepSnake,
  tickMsForScore,
} from './gameSnakeLogic';

const STORAGE_BEST = 'navisphere-snake-best';

// 1) Purpose: convertir un swipe (delta x/y) en direction discrète si le geste est assez long.
// 2) Key variables: `min` seuil en pixels pour ignorer les micro-mouvements.
// 3) Logic flow: axe dominant |dx| vs |dy| puis signe.
function swipeToDir(dx: number, dy: number, min: number): Dir | null {
  if (Math.abs(dx) < min && Math.abs(dy) < min) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

// 1) Purpose: dessiner la grille, le serpent et la pomme sur le canvas (couleurs lisibles sur fond NaviSphere).
// 2) Key variables: `cell` taille d’une case ; `state` snapshot courant.
// 3) Logic flow: fond sombre → cases → pomme → corps puis tête plus claire.
function drawGame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SnakeState,
) {
  const cell = Math.min(width, height) / GRID_SIZE;
  const ox = (width - cell * GRID_SIZE) / 2;
  const oy = (height - cell * GRID_SIZE) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i++) {
    const p = i * cell;
    ctx.beginPath();
    ctx.moveTo(ox + p, oy);
    ctx.lineTo(ox + p, oy + cell * GRID_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox, oy + p);
    ctx.lineTo(ox + cell * GRID_SIZE, oy + p);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(248, 113, 113, 0.95)';
  ctx.fillRect(
    ox + state.food.x * cell + 1,
    oy + state.food.y * cell + 1,
    cell - 2,
    cell - 2,
  );

  state.snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? 'rgba(134, 239, 172, 0.95)' : 'rgba(74, 222, 128, 0.85)';
    ctx.fillRect(ox + seg.x * cell + 1, oy + seg.y * cell + 1, cell - 2, cell - 2);
  });
}

// 1) Purpose: Snake en panneau central — boucle temps réel, swipes tactiles, flèches/WASD au clavier.
// 2) Key variables: `state` ; `best` (localStorage) ; `touchStart` pour le swipe.
// 3) Logic flow: timeout récurrent selon score → `stepSnake` ; swipe → `queueSnakeDirection`.
export function SnakeGame() {
  const [state, setState] = useState<SnakeState>(() => createInitialSnakeState());
  const [best, setBest] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_BEST);
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ w: 320, h: 320 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 320;
      const h = Math.min(w, 360);
      setBounds({ w, h });
    });
    ro.observe(el);
    const w = el.clientWidth || 320;
    setBounds({ w, h: Math.min(w, 360) });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = bounds;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGame(ctx, w, h, state);
  }, [state, bounds]);

  useEffect(() => {
    if (state.gameOver || state.paused) return;
    const delay = tickMsForScore(state.score);
    const id = window.setTimeout(() => {
      setState((s) => {
        const next = stepSnake(s);
        setBest((prev) => {
          if (next.score <= prev) return prev;
          try {
            localStorage.setItem(STORAGE_BEST, String(next.score));
          } catch {
            /* ignore */
          }
          return next.score;
        });
        return next;
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [state]);

  const applyDir = useCallback((dir: Dir) => {
    setState((s) => queueSnakeDirection(s, dir));
  }, []);

  const gameOverRef = useRef(false);
  gameOverRef.current = state.gameOver;

  // 1) Purpose: flèches + WASD avec écoute en phase capture pour devancer le scroll du panneau central.
  // 2) Key variables: `e.key` et `e.code` (ArrowUp…) pour compatibilité claviers / OS.
  // 3) Logic flow: stopPropagation + preventDefault sur les directions ; espace = pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;
      const k = e.key;
      const c = e.code;
      let dir: Dir | null = null;
      if (k === 'ArrowUp' || c === 'ArrowUp' || k === 'w' || k === 'W') dir = 'up';
      else if (k === 'ArrowDown' || c === 'ArrowDown' || k === 's' || k === 'S') dir = 'down';
      else if (k === 'ArrowLeft' || c === 'ArrowLeft' || k === 'a' || k === 'A') dir = 'left';
      else if (k === 'ArrowRight' || c === 'ArrowRight' || k === 'd' || k === 'D') dir = 'right';
      else if (k === ' ') {
        e.preventDefault();
        setState((s) => ({ ...s, paused: !s.paused }));
        return;
      }
      if (dir) {
        e.preventDefault();
        e.stopPropagation();
        applyDir(dir);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [applyDir]);

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const dir = swipeToDir(dx, dy, 24);
    setTouchStart(null);
    if (dir) applyDir(dir);
  };

  const reset = () => {
    setState(createInitialSnakeState());
  };

  return (
    <div className="flex max-w-md flex-col gap-3" tabIndex={-1}>
      {/* 4) Instructions: swipes tactiles ; flèches directionnelles + WASD (priorité sur le défilement du panneau). */}
      <p className="text-xs text-white/45">
        Glissez sur la zone de jeu pour diriger le serpent. Flèches directionnelles (↑↓←→) ou WASD ; espace pour
        pause.
      </p>

      <div className="flex gap-2">
        <div className="flex-1 rounded-[12px] bg-black/30 px-3 py-2 text-center ring-1 ring-white/10">
          <p className="text-[10px] uppercase tracking-wider text-white/45">Score</p>
          <p className="text-lg font-semibold text-white">{state.score}</p>
        </div>
        <div className="flex-1 rounded-[12px] bg-black/30 px-3 py-2 text-center ring-1 ring-white/10">
          <p className="text-[10px] uppercase tracking-wider text-white/45">Meilleur</p>
          <p className="text-lg font-semibold text-emerald-200/90">{best}</p>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-[14px] ring-1 ring-white/10"
        style={{ touchAction: 'none' }}
        onTouchStart={(ev) => {
          const t = ev.touches[0];
          if (t) setTouchStart({ x: t.clientX, y: t.clientY });
        }}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} className="block w-full max-h-[360px] bg-black/20" aria-label="Aire de jeu Snake" />

        {state.paused && !state.gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-center">
            <p className="text-sm font-medium text-white">Pause — Espace pour reprendre</p>
          </div>
        )}

        {state.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 p-4 text-center">
            <p className="text-lg font-semibold text-white">Partie terminée</p>
            <button
              type="button"
              onClick={reset}
              className="mt-3 rounded-[12px] bg-white/[0.15] px-4 py-2 text-sm text-white ring-1 ring-white/20"
            >
              Rejouer
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, paused: !s.paused }))}
          className="flex-1 rounded-[12px] bg-white/[0.09] px-3 py-2 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/[0.14]"
        >
          {state.paused ? 'Reprendre' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-[12px] bg-white/[0.09] px-3 py-2 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/[0.14]"
        >
          Nouvelle partie
        </button>
      </div>
    </div>
  );
}
