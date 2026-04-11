import { useEffect, useState } from 'react';

// 1) Purpose: afficher en direct les dimensions utiles pour reproduire le rendu Tesla dans Chrome (viewport, écran, DPR).
// 2) Key variables: `inner` = `window.innerWidth/Height` (zone de mise en page) ; `screen` = résolution signalée ; `dpr` = densité.
// 3) Logic flow: activé si `?debugViewport=1` ou `?res=1` ; écoute `resize` + `visualviewport` pour mise à jour live.
function readMetrics(): {
  innerW: number;
  innerH: number;
  screenW: number;
  screenH: number;
  dpr: number;
  vvW: number | null;
  vvH: number | null;
} {
  const vv = window.visualViewport;
  return {
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    screenW: window.screen.width,
    screenH: window.screen.height,
    dpr: window.devicePixelRatio || 1,
    vvW: vv?.width ?? null,
    vvH: vv?.height ?? null,
  };
}

export function ViewportDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [m, setM] = useState(readMetrics);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const on =
      params.get('debugViewport') === '1' ||
      params.get('res') === '1' ||
      params.get('viewport') === '1';
    setEnabled(on);
    if (!on) return;

    const tick = () => setM(readMetrics());
    tick();
    window.addEventListener('resize', tick);
    window.addEventListener('orientationchange', tick);
    window.visualViewport?.addEventListener('resize', tick);
    window.visualViewport?.addEventListener('scroll', tick);
    return () => {
      window.removeEventListener('resize', tick);
      window.removeEventListener('orientationchange', tick);
      window.visualViewport?.removeEventListener('resize', tick);
      window.visualViewport?.removeEventListener('scroll', tick);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-16 left-3 z-[9999] max-w-[min(100vw-1.5rem,280px)] rounded-lg border border-white/20 bg-black/80 px-2.5 py-2 font-mono text-[10px] leading-snug text-emerald-200/95 shadow-lg backdrop-blur-sm sm:bottom-20 sm:left-4 sm:text-[11px]"
      aria-live="polite"
      role="status"
    >
      <p className="mb-1 font-sans text-[9px] uppercase tracking-wider text-white/50">Debug viewport</p>
      <p>
        <span className="text-white/55">inner (layout) </span>
        {m.innerW}×{m.innerH}
      </p>
      {m.vvW != null && m.vvH != null && (
        <p>
          <span className="text-white/55">visualViewport </span>
          {Math.round(m.vvW)}×{Math.round(m.vvH)}
        </p>
      )}
      <p>
        <span className="text-white/55">screen </span>
        {m.screenW}×{m.screenH}
      </p>
      <p>
        <span className="text-white/55">DPR </span>
        {m.dpr}
      </p>
      <p className="mt-1.5 border-t border-white/10 pt-1.5 text-white/40">
        Ouvrir avec <code className="text-emerald-300/90">?debugViewport=1</code>
      </p>
    </div>
  );
}
