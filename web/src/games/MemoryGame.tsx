import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PAIR_COUNT = 16;
const GRID_COLS = 8;
const GRID_ROWS = 4;
const BACK_SRC = '/assets/images/games/memory/back.jpg';

// 1) Purpose: URL publique de la face numéro `n` (1…16), même dossier que le dos.
// 2) Key variables: extension `.jpg` alignée sur les assets du dépôt.
// 3) Logic flow: utilisé dans `img` pour chaque paire identique.
function faceSrc(n: number): string {
  return `/assets/images/games/memory/${n}.jpg`;
}

type CardModel = {
  uid: string;
  pairId: number;
};

// 1) Purpose: mélanger aléatoirement les 32 cartes (16 paires) pour la grille 4×8.
// 2) Key variables: copie du tableau puis échanges Fisher–Yates.
// 3) Logic flow: indice décroissant, swap avec j aléatoire ∈ [0, i].
function shuffleDeck(): CardModel[] {
  const list: CardModel[] = [];
  for (let p = 1; p <= PAIR_COUNT; p += 1) {
    list.push({ uid: `${p}-0`, pairId: p }, { uid: `${p}-1`, pairId: p });
  }
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

// 1) Purpose: carte Memory 3D — dos commun, face image ; flip et disparition pilotés par les props.
// 2) Key variables: `showFace` contrôle rotateY ; `vanishing` lance l’animation de sortie ; `gone` retire la carte du tapis.
// 3) Logic flow: clic bouton → callback parent ; `preserve-3d` + `backface-hidden` pour un retournement propre.
function MemoryCard({
  pairId,
  showFace,
  vanishing,
  gone,
  disabled,
  onFlip,
}: {
  pairId: number;
  showFace: boolean;
  vanishing: boolean;
  gone: boolean;
  disabled: boolean;
  onFlip: () => void;
}) {
  if (gone) {
    return <div className="memory-card-slot aspect-square min-h-0 w-full rounded-xl" aria-hidden />;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onFlip}
      className="memory-card-slot group aspect-square min-h-0 w-full cursor-pointer rounded-xl border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:cursor-default"
      aria-label={showFace ? `Carte paire ${pairId} visible` : 'Carte face cachée'}
    >
      <div
        className={`memory-card-3d relative h-full w-full [perspective:920px] ${vanishing ? 'memory-card-vanish' : ''}`}
      >
        <div
          className="memory-card-flipper relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: showFace ? 'rotateY(180deg)' : 'rotateY(0deg)', transformStyle: 'preserve-3d' }}
        >
          <div
            className="memory-card-face absolute inset-0 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.45)] [backface-visibility:hidden]"
            style={{ transform: 'rotateY(0deg)' }}
          >
            <img
              src={BACK_SRC}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] group-disabled:group-hover:scale-100"
              draggable={false}
            />
          </div>
          <div
            className="memory-card-face absolute inset-0 overflow-hidden rounded-xl ring-1 ring-cyan-400/25 shadow-[0_8px_28px_rgba(0,0,0,0.45)] [backface-visibility:hidden]"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <img
              src={faceSrc(pairId)}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

// 1) Purpose: jeu Memory 16 paires sur grille 4×8 — retournement au clic, paires identiques retirées du tapis.
// 2) Key variables: `deck` ordre fixe après mélange ; `revealed` jusqu’à 2 `uid` ; `matched` / `vanished` par `pairId` ; `busy` bloque les clics entre deux révélations.
// 3) Logic flow: 2e carte → comparaison → timeout match (disparition) ou mismatch (retour dos) ; victoire si 16 paires disparues.
export function MemoryGame() {
  const [deck, setDeck] = useState<CardModel[]>(() => shuffleDeck());
  const [revealed, setRevealed] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<number>>(() => new Set());
  const [vanishingPairIds, setVanishingPairIds] = useState<Set<number>>(() => new Set());
  const [vanishedPairIds, setVanishedPairIds] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardBounds, setBoardBounds] = useState({ w: 320, h: 160 });

  const cardByUid = useMemo(() => {
    const m = new Map<string, CardModel>();
    deck.forEach((c) => m.set(c.uid, c));
    return m;
  }, [deck]);

  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;

    // 4) Purpose: dimensionner la grille Memory au maximum sans scroll dans la zone disponible.
    //    Key variables: `availW`/`availH` (viewport local), `cell` (taille d'une case carrée), `w`/`h` (grille finale).
    //    Logic flow: observer resize -> calcule `cell = min(availW/8, availH/4)` -> applique dimensions exactes.
    const fitBoard = () => {
      const availW = el.clientWidth || 320;
      const availH = el.clientHeight || 160;
      const cell = Math.min(availW / GRID_COLS, availH / GRID_ROWS);
      setBoardBounds({
        w: cell * GRID_COLS,
        h: cell * GRID_ROWS,
      });
    };

    const ro = new ResizeObserver(fitBoard);
    ro.observe(el);
    fitBoard();
    return () => ro.disconnect();
  }, []);

  const reset = useCallback(() => {
    setDeck(shuffleDeck());
    setRevealed([]);
    setMatchedPairIds(new Set());
    setVanishingPairIds(new Set());
    setVanishedPairIds(new Set());
    setBusy(false);
    setMoves(0);
    setWon(false);
  }, []);

  const onCardClick = useCallback(
    (uid: string) => {
      if (busy || won) return;
      const card = cardByUid.get(uid);
      if (!card) return;
      if (vanishedPairIds.has(card.pairId)) return;
      if (revealed.includes(uid)) return;
      if (revealed.length >= 2) return;

      const nextRevealed = [...revealed, uid];
      setRevealed(nextRevealed);

      if (nextRevealed.length === 1) return;

      setMoves((m) => m + 1);
      const a = cardByUid.get(nextRevealed[0]!)!;
      const b = cardByUid.get(nextRevealed[1]!)!;
      const isMatch = a.pairId === b.pairId;

      if (isMatch) {
        setBusy(true);
        window.setTimeout(() => {
          setMatchedPairIds((prev) => new Set(prev).add(a.pairId));
          setVanishingPairIds((prev) => new Set(prev).add(a.pairId));
          setRevealed([]);
          window.setTimeout(() => {
            setVanishedPairIds((prev) => {
              const n = new Set(prev).add(a.pairId);
              if (n.size >= PAIR_COUNT) setWon(true);
              return n;
            });
            setVanishingPairIds((prev) => {
              const n = new Set(prev);
              n.delete(a.pairId);
              return n;
            });
            setBusy(false);
          }, 520);
        }, 380);
      } else {
        setBusy(true);
        window.setTimeout(() => {
          setRevealed([]);
          setBusy(false);
        }, 820);
      }
    },
    [busy, won, cardByUid, revealed, vanishedPairIds],
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3" tabIndex={-1}>
      {/* 4) Barre stats + nouvelle partie : même esprit que Snake / 2048 dans le panneau central. */}
      <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:flex-nowrap">
        <div className="min-w-0 flex-1 rounded-[14px] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3 sm:py-2.5">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/40 sm:text-[10px] sm:tracking-[0.2em]">Coups</p>
          <p className="text-base font-semibold tabular-nums text-white sm:text-lg">{moves}</p>
        </div>
        <div className="min-w-0 flex-1 rounded-[14px] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3 sm:py-2.5">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/40 sm:text-[10px] sm:tracking-[0.2em]">Paires</p>
          <p className="text-base font-semibold tabular-nums text-sky-200/95 sm:text-lg">
            {vanishedPairIds.size}/{PAIR_COUNT}
          </p>
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
        ref={boardWrapRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c1018]/90 to-[#0a0e14]/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-3"
      >
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="grid gap-1.5 sm:gap-2"
            style={{
              width: boardBounds.w,
              height: boardBounds.h,
              gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
            }}
          >
            {deck.map((card) => {
              const gone = vanishedPairIds.has(card.pairId);
              const showFace =
                revealed.includes(card.uid) || (matchedPairIds.has(card.pairId) && !gone);
              const vanishing = vanishingPairIds.has(card.pairId);
              const disabled = busy || gone || revealed.includes(card.uid);

              return (
                <MemoryCard
                  key={card.uid}
                  pairId={card.pairId}
                  showFace={showFace}
                  vanishing={vanishing}
                  gone={gone}
                  disabled={disabled}
                  onFlip={() => onCardClick(card.uid)}
                />
              );
            })}
          </div>
        </div>

        {won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/55 p-4 text-center backdrop-blur-[3px]">
            <p className="text-lg font-semibold text-white">Bravo !</p>
            <p className="mt-1 text-sm text-white/70">
              Toutes les paires trouvées en {moves} coups.
            </p>
            <button
              type="button"
              onClick={reset}
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
