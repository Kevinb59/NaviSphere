import { animate, motion, useMotionValue } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameDifficultyLevel } from './gameDifficulty';
import {
  CF_COLS,
  CF_ROWS,
  cfAiChooseMove,
  cfApplyMove,
  cfEmptyBoard,
  cfGetLandingRow,
  cfNextPlayer,
  cfOutcome,
  type CFBoard,
  type CFOutcome,
  type CFPlayer,
} from './gameConnectFourLogic';

type GameMode = 'pvp' | 'ai';

const AI_DELAY_MS = 280;

const DISC_RED =
  'bg-gradient-to-br from-rose-300 via-rose-500 to-red-900 shadow-[0_0_16px_rgba(251,113,133,0.55)] ring-2 ring-rose-200/35';
const DISC_YELLOW =
  'bg-gradient-to-br from-amber-100 via-amber-400 to-amber-800 shadow-[0_0_16px_rgba(250,204,21,0.48)] ring-2 ring-amber-200/30';

// 1) Purpose: jeton coloré (rouge / jaune) avec rendu « néon » cohérent NaviSphere.
// 2) Key variables: `player` → classes dégradé.
// 3) Logic flow: disque plein arrondi, taille imposée par le parent.
function CfDisc({ player, className }: { player: CFPlayer; className?: string }) {
  return (
    <div
      className={`rounded-full ${player === 'R' ? DISC_RED : DISC_YELLOW} ${className ?? ''}`}
      aria-hidden
    />
  );
}

// 1) Purpose: une case du plateau (trou du support + jeton statique éventuel).
// 2) Key variables: `highlight` pour la ligne victorieuse ; `showDisc` masque le pion pendant la chute sur cette case.
// 3) Logic flow: fond sombre incurvé ; `CfDisc` centré si `value` et visible.
function CfSlot({
  value,
  highlight,
  showDisc,
}: {
  value: CFPlayer | null;
  highlight: boolean;
  showDisc: boolean;
}) {
  return (
    <div
      data-cf-cell
      className={`relative flex min-h-0 flex-1 items-center justify-center rounded-full p-0.5 ${
        highlight
          ? 'bg-cyan-500/25 ring-2 ring-cyan-300/70'
          : 'bg-black/55 ring-2 ring-inset ring-cyan-950/50 shadow-[inset_0_2px_12px_rgba(0,0,0,0.65)]'
      }`}
    >
      {value && showDisc ? <CfDisc player={value} className="h-[88%] w-[88%] min-h-[1.5rem] min-w-[1.5rem]" /> : null}
    </div>
  );
}

// 1) Purpose: Puissance 4 — 7×6, cadre futuriste, chute animée depuis le haut de la colonne.
// 2) Key variables: `board`, `dropAnim` (col, ligne, joueur) ; `mode` / `difficulty` ; métrique `cellStride` pour la physique de chute.
// 3) Logic flow: clic colonne → animation → commit `cfApplyMove` ; vs IA → effet retardé + même pipeline.
export function ConnectFourGame() {
  const [board, setBoard] = useState<CFBoard>(() => cfEmptyBoard());
  const [mode, setMode] = useState<GameMode>('pvp');
  const [difficulty, setDifficulty] = useState<GameDifficultyLevel>('medium');
  const [dropAnim, setDropAnim] = useState<null | { col: number; row: number; player: CFPlayer }>(null);

  const columnRef = useRef<HTMLDivElement>(null);
  const [cellStride, setCellStride] = useState(52);
  const cellStrideRef = useRef(cellStride);
  cellStrideRef.current = cellStride;
  const dropY = useMotionValue(0);
  const [dropVisualActive, setDropVisualActive] = useState(false);

  const outcome: CFOutcome = useMemo(() => cfOutcome(board), [board]);

  const winSet = useMemo(() => {
    if (outcome.type !== 'win') return null;
    return new Set(outcome.line.map(([r, c]) => `${r},${c}`));
  }, [outcome]);

  // 4) Bloc mesure: hauteur d’une case + interstice pour positionner la chute au pixel près.
  //    Variables clés: première `[data-cf-cell]` de la colonne de référence, `gap` aligné sur `gap-1.5`.
  //    Flux: ResizeObserver sur la colonne → `cellStride = h + gap`.
  useLayoutEffect(() => {
    const col = columnRef.current;
    if (!col) return;
    const gap = 6;
    const measure = () => {
      const first = col.querySelector('[data-cf-cell]') as HTMLElement | null;
      if (!first) return;
      const h = first.getBoundingClientRect().height;
      setCellStride(h + gap);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(col);
    return () => ro.disconnect();
  }, []);

  const reset = useCallback(() => {
    setBoard(cfEmptyBoard());
    setDropAnim(null);
    setDropVisualActive(false);
  }, []);

  const setModeAndReset = useCallback((m: GameMode) => {
    setMode(m);
    setBoard(cfEmptyBoard());
    setDropAnim(null);
    setDropVisualActive(false);
  }, []);

  const setDifficultyAndReset = useCallback((d: GameDifficultyLevel) => {
    setDifficulty(d);
    setBoard(cfEmptyBoard());
    setDropAnim(null);
    setDropVisualActive(false);
  }, []);

  const finishDrop = useCallback((col: number, player: CFPlayer) => {
    setBoard((b) => cfApplyMove(b, col, player) ?? b);
    setDropAnim(null);
    setDropVisualActive(false);
  }, []);

  // 4) Bloc animation de chute: `animate` sur `dropY` puis commit ; annulation si composant démonte.
  //    Variables clés: `cellStride`, ligne d’atterrissage `row`, colonne `col`.
  //    Flux: départ négatif (au-dessus du cadre) → cible alignée sur le centre de la ligne `row`.
  useEffect(() => {
    if (!dropAnim) {
      dropY.set(0);
      setDropVisualActive(false);
      return;
    }
    const { col, row, player } = dropAnim;
    setDropVisualActive(true);
    const stride = cellStrideRef.current;
    const from = -stride * 1.35;
    const to = row * stride;
    dropY.set(from);
    const controls = animate(dropY, to, {
      type: 'tween',
      duration: 0.5,
      ease: [0.22, 0.82, 0.18, 1],
      onComplete: () => finishDrop(col, player),
    });
    return () => controls.stop();
  }, [dropAnim, dropY, finishDrop]);

  const requestDrop = useCallback(
    (col: number) => {
      if (dropAnim !== null) return;
      if (outcome.type !== 'playing') return;
      const turn = cfNextPlayer(board);
      if (mode === 'ai' && turn === 'Y') return;
      const row = cfGetLandingRow(board, col);
      if (row === null) return;
      setDropAnim({ col, row, player: turn });
    },
    [board, dropAnim, mode, outcome.type],
  );

  // 4) Bloc tour IA (jaune): après coup humain, choix `cfAiChooseMove` puis même `setDropAnim`.
  //    Variables clés: `difficulty`, garde `dropAnim` null et partie en cours.
  //    Flux: timeout → colonne légale → lancement chute Tesla.
  useEffect(() => {
    if (mode !== 'ai') return;
    if (dropAnim !== null) return;
    if (outcome.type !== 'playing') return;
    if (cfNextPlayer(board) !== 'Y') return;

    const t = window.setTimeout(() => {
      const col = cfAiChooseMove(board, difficulty);
      if (col < 0) return;
      const row = cfGetLandingRow(board, col);
      if (row === null) return;
      setDropAnim({ col, row, player: 'Y' });
    }, AI_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [board, mode, difficulty, dropAnim, outcome.type]);

  const statusText =
    outcome.type === 'win'
      ? outcome.player === 'R'
        ? 'Victoire des rouges.'
        : mode === 'ai'
          ? 'Victoire des jaunes (Tesla).'
          : 'Victoire des jaunes.'
      : outcome.type === 'draw'
        ? 'Match nul — grille pleine.'
        : mode === 'ai' && cfNextPlayer(board) === 'Y'
          ? 'Tesla réfléchit…'
          : cfNextPlayer(board) === 'R'
            ? 'Tour du rouge.'
            : 'Tour du jaune.';

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3" tabIndex={-1}>
      {/* 4) Contrôles mode / difficulté — même logique que Morpion (largeurs contenu). */}
      <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2">
        <div
          className="flex shrink-0 flex-wrap items-center justify-center gap-1 rounded-xl border border-white/12 bg-black/25 p-1 backdrop-blur-sm"
          role="group"
          aria-label="Mode de jeu"
        >
          <button
            type="button"
            onClick={() => setModeAndReset('pvp')}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm ${
              mode === 'pvp' ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/8'
            }`}
          >
            2 joueurs
          </button>
          <button
            type="button"
            onClick={() => setModeAndReset('ai')}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm ${
              mode === 'ai' ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/8'
            }`}
          >
            vs Tesla
          </button>
        </div>

        {mode === 'ai' && (
          <div
            className="flex shrink-0 flex-wrap items-center justify-center gap-1 rounded-xl border border-white/12 bg-black/25 p-1 backdrop-blur-sm"
            role="group"
            aria-label="Difficulté de l’IA"
          >
            {(
              [
                { id: 'easy' as const, label: 'Facile' },
                { id: 'medium' as const, label: 'Moyen' },
                { id: 'hard' as const, label: 'Difficile' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDifficultyAndReset(id)}
                className={`rounded-lg px-2.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
                  difficulty === id ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/8'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/40 sm:px-4 sm:text-sm"
        >
          Nouvelle partie
        </button>
      </div>

      <p className="shrink-0 text-center text-sm font-medium text-white/80" aria-live="polite">
        {statusText}
      </p>
      {mode === 'ai' && (
        <p className="shrink-0 text-center text-[11px] text-white/45">
          Vous jouez le rouge · Tesla le jaune — cliquez une colonne pour lâcher le jeton.
        </p>
      )}

      {/* 4) Cadre « support » Puissance 4 : biseau lumineux, fond sombre, colonnes cliquables. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-1">
        <div
          className="relative w-full max-w-[min(96vw,640px)] rounded-[28px] border border-cyan-400/25 bg-gradient-to-b from-slate-900/92 via-slate-950/95 to-black/90 p-3 shadow-[0_0_48px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/10 sm:p-4"
          role="presentation"
        >
          <div
            className="pointer-events-none absolute inset-x-4 top-2 h-2 rounded-full bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent"
            aria-hidden
          />
          <div className="flex gap-1.5 sm:gap-2" role="grid" aria-label="Grille Puissance 4, 7 colonnes">
            {Array.from({ length: CF_COLS }, (_, col) => (
              <div key={col} className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
                <button
                  type="button"
                  disabled={
                    dropAnim !== null ||
                    outcome.type !== 'playing' ||
                    (mode === 'ai' && cfNextPlayer(board) === 'Y') ||
                    cfGetLandingRow(board, col) === null
                  }
                  onClick={() => requestDrop(col)}
                  className="mb-0.5 shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-100/80 transition hover:border-cyan-400/35 hover:bg-cyan-500/15 disabled:cursor-default disabled:opacity-35 sm:text-[11px]"
                  aria-label={`Déposer un jeton dans la colonne ${col + 1}`}
                >
                  ▼
                </button>

                {/* 4) Zone de grille seule : `relative` pour ancrer la chute sans chevaucher le bouton colonne. */}
                <div
                  ref={col === 0 ? columnRef : undefined}
                  className="relative flex min-h-[min(40vh,280px)] flex-1 flex-col gap-1.5 sm:min-h-[min(42vh,320px)] sm:gap-2"
                >
                  {Array.from({ length: CF_ROWS }, (_, ri) => {
                    const r = ri;
                    const value = board[r]![col];
                    const key = `${r},${col}`;
                    const highlight = winSet?.has(key) ?? false;
                    const hideStatic =
                      dropAnim !== null &&
                      dropAnim.col === col &&
                      dropAnim.row === r &&
                      dropVisualActive;
                    return (
                      <CfSlot
                        key={r}
                        value={value}
                        highlight={highlight}
                        showDisc={!hideStatic}
                      />
                    );
                  })}

                  {dropAnim !== null && dropAnim.col === col && dropVisualActive ? (
                    <motion.div
                      className="pointer-events-none absolute left-0.5 right-0.5 z-10 flex items-center justify-center"
                      style={{
                        top: 0,
                        height: Math.max(24, cellStrideRef.current - 6),
                        y: dropY,
                      }}
                    >
                      <CfDisc player={dropAnim.player} className="h-[88%] w-[88%] min-h-[1.5rem] min-w-[1.5rem]" />
                    </motion.div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
