import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TB_PLAY_WIDTH,
  TB_SLICE_HEIGHT,
  towerComputePlace,
  towerLayerRgb,
  towerOscillationAmplitude,
  towerSpeedPxPerFrame,
} from './gameTowerBlocksLogic';

type Phase = 'ready' | 'playing' | 'ended';

type Placed = { centerX: number; width: number };

// 1) Purpose: barre horizontale colorée (une couche de la tour).
// 2) Key variables: position `left` en px depuis la gauche du jeu ; `bottom` empile vers le haut.
// 3) Logic flow: styles inline pour RGB dynamique.
function TowerLayer({
  centerX,
  width,
  bottom,
  rgb,
  isBase,
}: {
  centerX: number;
  width: number;
  bottom: number;
  rgb: { r: number; g: number; b: number };
  isBase: boolean;
}) {
  const left = centerX - width / 2;
  return (
    <div
      className={`absolute rounded-md ring-1 transition-shadow ${
        isBase
          ? 'bg-[#333344] ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
          : 'shadow-[0_0_14px_rgba(255,255,255,0.12)] ring-white/20'
      }`}
      style={{
        left,
        width,
        bottom,
        height: TB_SLICE_HEIGHT - 4,
        backgroundColor: isBase ? undefined : `rgb(${rgb.r},${rgb.g},${rgb.b})`,
      }}
    />
  );
}

// 1) Purpose: Gratte-ciel — empilement de blocs (inspiré Tower Blocks / Three.js du dépôt Talha, ici en 2D canvas-logic).
// 2) Key variables: `placed` tour figée ; ref `anim` pour oscillation ; `phase` menu / jeu / fin.
// 3) Logic flow: rAF → déplacement ; clic / espace → `towerComputePlace` → append ou game over ; défilement vertical si la tour grandit.
export function TowerBlocksGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [, setRenderTick] = useState(0);
  const [perfectPulse, setPerfectPulse] = useState(false);

  const colorOffsetRef = useRef(Math.floor(Math.random() * 100));
  const playRef = useRef<HTMLDivElement>(null);

  // 4) Ref animation : offset par rapport au centre du bloc cible, rebonds sur ±amplitude (équivalent script source).
  //    Variables clés: `movingWidth`, `prevCenter`, `amplitude`, `dir`.
  //    Flux: chaque frame `offset += dir * speed` puis clamp / inversion.
  const anim = useRef({
    offset: 0,
    dir: 1 as 1 | -1,
    movingWidth: TB_PLAY_WIDTH * 0.88,
    prevCenter: TB_PLAY_WIDTH / 2,
    amplitude: towerOscillationAmplitude(TB_PLAY_WIDTH, TB_PLAY_WIDTH * 0.88),
  });

  const score = Math.max(0, placed.length - 1);

  const startGame = useCallback(() => {
    const baseW = TB_PLAY_WIDTH * 0.88;
    const pc = TB_PLAY_WIDTH / 2;
    const amp = towerOscillationAmplitude(TB_PLAY_WIDTH, baseW);
    const startOff = Math.random() > 0.5 ? amp : -amp;
    anim.current = {
      offset: startOff,
      dir: startOff > 0 ? (-1 as const) : (1 as const),
      movingWidth: baseW,
      prevCenter: pc,
      amplitude: amp,
    };
    setPlaced([{ centerX: pc, width: baseW }]);
    setPhase('playing');
  }, []);

  const placeBlock = useCallback(() => {
    if (phase !== 'playing') return;
    const top = placed[placed.length - 1];
    if (!top) return;

    const mc = anim.current.prevCenter + anim.current.offset;
    const res = towerComputePlace(mc, anim.current.movingWidth, top.centerX, top.width);
    if (!res.ok) {
      setPhase('ended');
      return;
    }

    if (res.perfect) {
      setPerfectPulse(true);
      window.setTimeout(() => setPerfectPulse(false), 220);
    }

    setPlaced((p) => [...p, { centerX: res.newCenter, width: res.newWidth }]);

    const amp = towerOscillationAmplitude(TB_PLAY_WIDTH, res.newWidth);
    const startOff = Math.random() > 0.5 ? amp : -amp;
    anim.current = {
      offset: startOff,
      dir: startOff > 0 ? (-1 as const) : (1 as const),
      movingWidth: res.newWidth,
      prevCenter: res.newCenter,
      amplitude: amp,
    };
  }, [phase, placed]);

  const onAction = useCallback(() => {
    if (phase === 'ready') startGame();
    else if (phase === 'playing') placeBlock();
    else startGame();
  }, [phase, startGame, placeBlock]);

  // 4) Boucle rAF pendant la partie : mise à jour oscillation + repaint via `renderTick`.
  //    Variables clés: `towerSpeedPxPerFrame(placed.length)` pour accélération comme l’original.
  //    Flux: inversion aux bornes [-amplitude, +amplitude].
  useEffect(() => {
    if (phase !== 'playing') return;
    let id = 0;
    const loop = () => {
      const a = anim.current;
      const speed = towerSpeedPxPerFrame(Math.max(1, placed.length));
      a.offset += a.dir * speed;
      if (a.offset >= a.amplitude) {
        a.offset = a.amplitude;
        a.dir = -1;
      } else if (a.offset <= -a.amplitude) {
        a.offset = -a.amplitude;
        a.dir = 1;
      }
      setRenderTick((t) => t + 1);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [phase, placed.length]);

  useEffect(() => {
    if (phase === 'playing') playRef.current?.focus();
  }, [phase]);

  const movingCenter = anim.current.prevCenter + anim.current.offset;
  const movingWidth = anim.current.movingWidth;
  const movingBottom = placed.length * TB_SLICE_HEIGHT;
  const movingRgb = towerLayerRgb(placed.length + 1, colorOffsetRef.current);

  const maxVisibleLayers = 14;
  const scrollLayers = Math.max(0, placed.length - maxVisibleLayers);
  const translateY = scrollLayers * TB_SLICE_HEIGHT;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center gap-3" tabIndex={-1}>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2">
        <div className="shrink-0 rounded-xl border border-white/12 bg-black/25 px-4 py-2 text-center backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">Étages</p>
          <p className="text-xl font-semibold tabular-nums text-white">{score}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/40 sm:px-4 sm:text-sm"
        >
          {phase === 'ready' ? 'Jouer' : phase === 'ended' ? 'Rejouer' : 'Poser (ou espace)'}
        </button>
      </div>

      <div
        ref={playRef}
        tabIndex={0}
        role="application"
        aria-label="Gratte-ciel — appuyez pour poser le bloc"
        className="relative w-full max-w-[320px] touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        style={{ height: maxVisibleLayers * TB_SLICE_HEIGHT + TB_SLICE_HEIGHT + 24 }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          if (phase === 'ended') return;
          e.preventDefault();
          onAction();
        }}
        onKeyDown={(e) => {
          if (e.code === 'Space') {
            e.preventDefault();
            onAction();
          }
        }}
      >
        <div
          className={`absolute inset-0 overflow-hidden rounded-[22px] border border-cyan-400/25 bg-gradient-to-b from-slate-900/95 to-black/95 shadow-[0_0_36px_rgba(34,211,238,0.1)] ring-1 ring-white/10 transition-[box-shadow] ${
            perfectPulse ? 'shadow-[0_0_48px_rgba(250,204,21,0.35)]' : ''
          }`}
        >
          <div
            className="relative mx-auto h-full"
            style={{ width: TB_PLAY_WIDTH, transform: `translateY(-${translateY}px)` }}
          >
            {placed.map((b, i) => (
              <TowerLayer
                key={`p-${i}`}
                centerX={b.centerX}
                width={b.width}
                bottom={i * TB_SLICE_HEIGHT}
                rgb={towerLayerRgb(i + 1, colorOffsetRef.current)}
                isBase={i === 0}
              />
            ))}

            {phase === 'playing' && (
              <TowerLayer
                centerX={movingCenter}
                width={movingWidth}
                bottom={movingBottom}
                rgb={movingRgb}
                isBase={false}
              />
            )}
          </div>
        </div>

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-[22px] bg-black/55 p-4 text-center backdrop-blur-[2px]">
            <p className="text-base font-semibold text-white">Gratte-ciel</p>
            <p className="mt-1 text-sm text-white/65">Tapez pour empiler les blocs alignés.</p>
          </div>
        )}

        {phase === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[22px] bg-black/70 p-4 text-center backdrop-blur-sm">
            <p className="text-lg font-semibold text-white">Tour effondrée</p>
            <p className="mt-1 text-sm text-white/70">
              {score} étage{score > 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={onAction}
              className="mt-5 rounded-[14px] border border-white/20 bg-white/[0.12] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.18]"
            >
              Rejouer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
