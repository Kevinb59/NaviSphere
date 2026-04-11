import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  aiChooseMove,
  emptyBoard,
  nextPlayer,
  outcome,
  type AiDifficulty,
  type Board,
  type Player,
} from './gameTicTacToeLogic';

type GameMode = 'pvp' | 'ai';

const AI_DELAY_MS = 320;

// 1) Purpose: libellé d’une case pour l’accessibilité (joueur, vide, index).
// 2) Key variables: `value` X/O ou vide.
// 3) Logic flow: phrase courte pour lecteurs d’écran.
function cellAriaLabel(i: number, value: Player | null): string {
  if (value === 'X') return `Case ${i + 1}, croix`;
  if (value === 'O') return `Case ${i + 1}, rond`;
  return `Case ${i + 1}, vide`;
}

// 1) Purpose: une case cliquable du morpion 3×3.
// 2) Key variables: `highlight` si la case fait partie de la ligne gagnante.
// 3) Logic flow: bouton désactivé si occupé, partie finie, ou tour de l’IA.
function BoardCell({
  index,
  value,
  disabled,
  highlight,
  onPlay,
}: {
  index: number;
  value: Player | null;
  disabled: boolean;
  highlight: boolean;
  onPlay: (i: number) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={cellAriaLabel(index, value)}
      onClick={() => onPlay(index)}
      className={`flex aspect-square min-h-[72px] min-w-0 items-center justify-center rounded-2xl text-4xl font-bold transition sm:min-h-[88px] sm:text-5xl ${
        highlight
          ? 'bg-emerald-500/35 ring-2 ring-emerald-300/80'
          : 'bg-black/30 ring-1 ring-white/12 hover:bg-black/40'
      } disabled:cursor-default disabled:opacity-90 ${value === 'X' ? 'text-sky-200' : value === 'O' ? 'text-fuchsia-200' : 'text-transparent'}`}
    >
      {value ?? '\u00a0'}
    </button>
  );
}

// 1) Purpose: morpion — 2 joueurs ou contre la Tesla (3 niveaux : aléatoire → heuristique → minimax).
// 2) Key variables: `board`, `mode`, `difficulty` ; X commence toujours ; humain seul en X contre l’IA.
// 3) Logic flow: clic case → pose X ou O (PvP) ; mode IA → effet différé pose O après `AI_DELAY_MS`.
export function TicTacToeGame() {
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [mode, setMode] = useState<GameMode>('pvp');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');

  const status = useMemo(() => outcome(board), [board]);
  const current = useMemo(() => nextPlayer(board), [board]);

  const isAiThinking = mode === 'ai' && status.type === 'ongoing' && current === 'O';

  const reset = useCallback(() => {
    setBoard(emptyBoard());
  }, []);

  const setModeAndReset = useCallback((m: GameMode) => {
    setMode(m);
    setBoard(emptyBoard());
  }, []);

  const setDifficultyAndReset = useCallback((d: AiDifficulty) => {
    setDifficulty(d);
    setBoard(emptyBoard());
  }, []);

  const onCell = useCallback(
    (index: number) => {
      if (status.type !== 'ongoing') return;
      if (board[index] !== null) return;
      const turn = nextPlayer(board);
      if (mode === 'ai' && turn === 'O') return;

      setBoard((b) => {
        if (outcome(b).type !== 'ongoing') return b;
        if (b[index] !== null) return b;
        const t = nextPlayer(b);
        if (mode === 'ai' && t === 'O') return b;
        const nb = b.slice() as Board;
        nb[index] = t;
        return nb;
      });
    },
    [board, mode, status.type],
  );

  // 4) Bloc IA : quand c’est au tour de O en mode « vs Tesla », calcule le coup après un court délai.
  //    Variables clés: `aiChooseMove`, `difficulty`, garde-fous `outcome` / `nextPlayer` sur l’état à jour.
  //    Flux: effet sur `board` → timeout → `setBoard` avec le coup O si toujours valide.
  useEffect(() => {
    if (mode !== 'ai') return;
    if (status.type !== 'ongoing') return;
    if (nextPlayer(board) !== 'O') return;

    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      setBoard((b) => {
        if (outcome(b).type !== 'ongoing') return b;
        if (nextPlayer(b) !== 'O') return b;
        const idx = aiChooseMove(b, difficulty);
        if (idx < 0) return b;
        const nb = b.slice() as Board;
        nb[idx] = 'O';
        return nb;
      });
    }, AI_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [board, mode, difficulty, status.type]);

  const winLine =
    status.type === 'win' ? new Set<number>([status.line[0], status.line[1], status.line[2]]) : null;

  const statusText =
    status.type === 'win'
      ? status.winner === 'X'
        ? 'Les croix ont gagné.'
        : 'Tesla (ronds) a gagné.'
      : status.type === 'draw'
        ? 'Match nul.'
        : mode === 'ai' && current === 'X'
          ? 'À vous (croix).'
          : mode === 'ai' && current === 'O'
            ? 'Tesla joue…'
            : current === 'X'
              ? 'Tour des croix.'
              : 'Tour des ronds.';

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3" tabIndex={-1}>
      {/* 4) Barre mode / difficulté + nouvelle partie : largeur contenu où c’est pertinent. */}
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
                { id: 'hard' as const, label: 'Minimax' },
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

      <div className="shrink-0 text-center">
        <p
          className={`text-sm font-medium ${isAiThinking ? 'text-cyan-200/90' : 'text-white/80'}`}
          aria-live="polite"
        >
          {statusText}
        </p>
        {mode === 'ai' && (
          <p className="mt-0.5 text-[11px] text-white/45">Vous jouez les croix (X), Tesla les ronds (O).</p>
        )}
      </div>

      {/* 4) Grille 3×3 sans cadre lourd : seules les cases comptent visuellement. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-1">
        <div
          className="grid w-full max-w-[min(88vmin,380px)] grid-cols-3 gap-2 sm:gap-3"
          role="grid"
          aria-label="Grille du morpion"
        >
          {board.map((value, i) => (
            <BoardCell
              key={i}
              index={i}
              value={value}
              highlight={winLine?.has(i) ?? false}
              disabled={
                value !== null ||
                status.type !== 'ongoing' ||
                (mode === 'ai' && nextPlayer(board) === 'O')
              }
              onPlay={onCell}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
