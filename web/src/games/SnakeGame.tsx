import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  type Dir,
  type Point,
  type SnakeState,
  createInitialSnakeState,
  queueSnakeDirection,
  stepSnake,
  tickMsForScore,
} from './gameSnakeLogic';

const STORAGE_BEST = 'navisphere-snake-best';
const URL_HEAD = '/assets/images/games/teslatop.png';
const URL_FOOD = '/assets/images/games/applesnake.png';

// 1) Purpose: aligner la vue de dessus Tesla (capot à droite dans le PNG) avec la direction de déplacement.
// 2) Key variables: angles en radians, sens horaire canvas (y vers le bas).
// 3) Logic flow: droite = 0 ; bas = π/2 ; gauche = π ; haut = −π/2.
function dirToAngleRad(dir: Dir): number {
  switch (dir) {
    case 'right':
      return 0;
    case 'down':
      return Math.PI / 2;
    case 'left':
      return Math.PI;
    case 'up':
      return -Math.PI / 2;
    default:
      return 0;
  }
}

// 1) Purpose: tracer un rectangle arrondi (traînée arc-en-ciel) sans dépendre uniquement de roundRect récent.
// 2) Key variables: `r` rayon borné par la moitié des côtés.
// 3) Logic flow: arc de coin + segments droits.
function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
  ctx.fill();
}

// 1) Purpose: dessiner image centrée sur une case ; `maxFill` peut dépasser 1 pour déborder légèrement (Tesla plus lisible).
// 2) Key variables: ratio naturel préservé ; boîte englobante ≤ `cell * maxFill`.
// 3) Logic flow: scale uniforme + rotation optionnelle autour du centre.
function drawImageInCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  cell: number,
  maxFill: number,
  rotationRad?: number,
) {
  const ar = img.naturalWidth / img.naturalHeight;
  const cap = cell * maxFill;
  let dw = cap;
  let dh = dw / ar;
  if (dh > cap) {
    dh = cap;
    dw = dh * ar;
  }
  ctx.save();
  ctx.translate(cx, cy);
  if (rotationRad !== undefined) ctx.rotate(rotationRad);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// 1) Purpose: traînée continue (un seul chemin) — dégradé tête→queue pour atténuer la fin, sans « points » aux jonctions.
// 2) Key variables: gradient linéaire du centre tête au centre queue ; lineJoin round pour virages fluides.
// 3) Logic flow: polyline unique → plusieurs strokes superposés (halos + cœur) sur le même tracé.
function drawLightTrail(
  ctx: CanvasRenderingContext2D,
  snake: Point[],
  ox: number,
  oy: number,
  cell: number,
) {
  if (snake.length < 2) return;

  const cx = (p: Point) => ox + p.x * cell + cell / 2;
  const cy = (p: Point) => oy + p.y * cell + cell / 2;
  const head = snake[0]!;
  const tail = snake[snake.length - 1]!;
  const hx = cx(head);
  const hy = cy(head);
  const tx = cx(tail);
  const ty = cy(tail);

  ctx.beginPath();
  ctx.moveTo(hx, hy);
  for (let i = 1; i < snake.length; i++) {
    ctx.lineTo(cx(snake[i]!), cy(snake[i]!));
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const gWide = ctx.createLinearGradient(hx, hy, tx, ty);
  gWide.addColorStop(0, 'rgba(160, 245, 255, 0.38)');
  gWide.addColorStop(0.25, 'rgba(100, 200, 255, 0.28)');
  gWide.addColorStop(0.55, 'rgba(140, 120, 255, 0.16)');
  gWide.addColorStop(0.82, 'rgba(90, 60, 160, 0.07)');
  gWide.addColorStop(1, 'rgba(40, 25, 80, 0.02)');

  ctx.strokeStyle = gWide;
  ctx.lineWidth = cell * 0.58;
  ctx.shadowBlur = cell * 0.48;
  ctx.shadowColor = 'rgba(130, 210, 255, 0.55)';
  ctx.stroke();

  const gMid = ctx.createLinearGradient(hx, hy, tx, ty);
  gMid.addColorStop(0, 'rgba(220, 255, 255, 0.5)');
  gMid.addColorStop(0.35, 'rgba(140, 210, 255, 0.32)');
  gMid.addColorStop(0.7, 'rgba(180, 140, 255, 0.14)');
  gMid.addColorStop(1, 'rgba(120, 100, 200, 0.04)');

  ctx.strokeStyle = gMid;
  ctx.lineWidth = cell * 0.32;
  ctx.shadowBlur = cell * 0.22;
  ctx.shadowColor = 'rgba(180, 230, 255, 0.45)';
  ctx.stroke();

  const gCore = ctx.createLinearGradient(hx, hy, tx, ty);
  gCore.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  gCore.addColorStop(0.4, 'rgba(230, 248, 255, 0.35)');
  gCore.addColorStop(0.75, 'rgba(200, 220, 255, 0.1)');
  gCore.addColorStop(1, 'rgba(180, 200, 255, 0.02)');

  ctx.strokeStyle = gCore;
  ctx.lineWidth = cell * 0.09;
  ctx.shadowBlur = cell * 0.12;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();

  ctx.shadowBlur = 0;
}

// 1) Purpose: rendu premium — fond nébuleux, grille quasi invisible, éclair + traînée lumineuse, Tesla agrandie au-dessus.
// 2) Key variables: `state.direction` pour la rotation ; `maxFill` tête ~1.3, pomme ~1.12.
// 3) Logic flow: fond → cadre léger → collectibles → traînée → tête.
function drawGame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SnakeState,
  assets: { head: HTMLImageElement; food: HTMLImageElement } | null,
) {
  const cell = Math.min(width / GRID_WIDTH, height / GRID_HEIGHT);
  const gw = cell * GRID_WIDTH;
  const gh = cell * GRID_HEIGHT;
  const ox = (width - gw) / 2;
  const oy = (height - gh) / 2;

  const rg = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    Math.min(width, height) * 0.08,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72,
  );
  rg.addColorStop(0, 'rgba(28, 42, 62, 0.5)');
  rg.addColorStop(0.45, 'rgba(12, 16, 26, 0.82)');
  rg.addColorStop(1, 'rgba(4, 6, 12, 0.92)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(120, 200, 255, 0.09)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, gw - 1, gh - 1);

  ctx.strokeStyle = 'rgba(255,255,255,0.024)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_WIDTH; i += 2) {
    const p = i * cell;
    ctx.beginPath();
    ctx.moveTo(ox + p, oy);
    ctx.lineTo(ox + p, oy + gh);
    ctx.stroke();
  }
  for (let j = 0; j <= GRID_HEIGHT; j += 2) {
    const p = j * cell;
    ctx.beginPath();
    ctx.moveTo(ox, oy + p);
    ctx.lineTo(ox + gw, oy + p);
    ctx.stroke();
  }

  const foodCx = ox + state.food.x * cell + cell / 2;
  const foodCy = oy + state.food.y * cell + cell / 2;
  if (assets?.food?.complete && assets.food.naturalWidth > 0) {
    ctx.save();
    ctx.shadowBlur = cell * 0.35;
    ctx.shadowColor = 'rgba(251, 191, 36, 0.55)';
    drawImageInCell(ctx, assets.food, foodCx, foodCy, cell, 1.12);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(251, 113, 133, 0.95)';
    const pad = cell * 0.08;
    fillRoundRect(
      ctx,
      ox + state.food.x * cell + pad,
      oy + state.food.y * cell + pad,
      cell - 2 * pad,
      cell - 2 * pad,
      cell * 0.2,
    );
  }

  const snake = state.snake;
  ctx.save();
  drawLightTrail(ctx, snake, ox, oy, cell);
  ctx.restore();

  const head = snake[0]!;
  const hcx = ox + head.x * cell + cell / 2;
  const hcy = oy + head.y * cell + cell / 2;
  const ang = dirToAngleRad(state.direction);
  if (assets?.head?.complete && assets.head.naturalWidth > 0) {
    ctx.save();
    ctx.shadowBlur = cell * 0.22;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
    drawImageInCell(ctx, assets.head, hcx, hcy, cell, 1.3, ang);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(hcx, hcy);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(243, 244, 246, 0.95)';
    const s = cell * 0.95;
    fillRoundRect(ctx, -s / 2, -s / 2, s, s, cell * 0.14);
    ctx.restore();
  }
}

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

// 1) Purpose: Snake Tesla — canvas, swipes, clavier, assets PNG tête / énergie.
// 2) Key variables: `state` ; `assetsRef` images chargées ; `best` localStorage.
// 3) Logic flow: idem version précédente avec rendu graphique enrichi.
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
  const [assetsReady, setAssetsReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const assetsRef = useRef<{ head: HTMLImageElement | null; food: HTMLImageElement | null }>({
    head: null,
    food: null,
  });
  const [bounds, setBounds] = useState({ w: 320, h: 320 });

  useEffect(() => {
    const head = new Image();
    const food = new Image();
    head.decoding = 'async';
    food.decoding = 'async';
    head.src = URL_HEAD;
    food.src = URL_FOOD;
    let loaded = 0;
    const onDone = () => {
      loaded += 1;
      if (loaded >= 2) {
        assetsRef.current = { head, food };
        setAssetsReady(true);
      }
    };
    head.onload = onDone;
    food.onload = onDone;
    head.onerror = onDone;
    food.onerror = onDone;
    if (head.complete && food.complete) {
      assetsRef.current = { head, food };
      setAssetsReady(true);
    }
    return () => {
      head.onload = null;
      food.onload = null;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // 4) Taille canvas = grille 40×25 exacte : largeur du conteneur, hauteur dérivée (pas de bandes vides).
    const fit = () => {
      const w = el.clientWidth || 320;
      const h = (w * GRID_HEIGHT) / GRID_WIDTH;
      setBounds({ w, h });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
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
    const a = assetsRef.current;
    const assets =
      a.head && a.food && assetsReady ? { head: a.head, food: a.food } : null;
    drawGame(ctx, w, h, state, assets);
  }, [state, bounds, assetsReady]);

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
    <div className="flex w-full min-w-0 flex-col gap-2" tabIndex={-1}>
      {/* 4) Barre d’action : Pause | Score | Meilleur | Nouvelle partie — pleine largeur du panneau central. */}
      <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:flex-nowrap">
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, paused: !s.paused }))}
          className="shrink-0 rounded-[14px] border border-white/12 bg-white/[0.06] px-3 py-2.5 text-xs font-medium text-white transition hover:bg-white/[0.11] sm:px-4 sm:text-sm"
        >
          {state.paused ? 'Reprendre' : 'Pause'}
        </button>
        <div className="min-w-0 flex-1 rounded-[14px] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3 sm:py-2.5">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/40 sm:text-[10px] sm:tracking-[0.2em]">Score</p>
          <p className="text-base font-semibold tabular-nums text-white sm:text-lg">{state.score}</p>
        </div>
        <div className="min-w-0 flex-1 rounded-[14px] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3 sm:py-2.5">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/40 sm:text-[10px] sm:tracking-[0.2em]">Meilleur</p>
          <p className="text-base font-semibold tabular-nums text-sky-200/95 sm:text-lg">{best}</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-[14px] border border-white/12 bg-white/[0.06] px-3 py-2.5 text-xs font-medium text-white transition hover:bg-white/[0.11] sm:px-4 sm:text-sm"
        >
          Nouvelle partie
        </button>
      </div>

      <div
        ref={wrapRef}
        className="relative aspect-[40/25] w-full min-w-0 touch-none select-none overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c1018]/90 to-[#0a0e14]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.35)]"
        style={{ touchAction: 'none' }}
        onTouchStart={(ev) => {
          const t = ev.touches[0];
          if (t) setTouchStart({ x: t.clientX, y: t.clientY });
        }}
        onTouchEnd={onTouchEnd}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-label="Aire de jeu Snake Tesla"
        />

        {state.paused && !state.gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <p className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-lg">
              Pause — Espace pour reprendre
            </p>
          </div>
        )}

        {state.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center backdrop-blur-[3px]">
            <p className="text-lg font-semibold text-white">Partie terminée</p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 rounded-[14px] border border-white/20 bg-white/[0.12] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.18]"
            >
              Rejouer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
