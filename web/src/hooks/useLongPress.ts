import { useCallback, useRef } from 'react';

// 1) Purpose:
// - Détecter un appui long (pointer) sans déclencher l'action court clic.
// 2) Key variables:
// - `durationMs`: seuil (ex. 1200 ms).
// - `longPressTriggered`: évite d'exécuter le clic après un long press.
// 3) Logic flow:
// - `pointerdown` démarre un timeout; `pointerup`/`leave`/`cancel` l'annulent; le timeout appelle `onLongPress`.

export function useLongPress(options: { durationMs: number; onLongPress: () => void }) {
  const { durationMs, onLongPress } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    longPressTriggeredRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress();
      timerRef.current = null;
    }, durationMs);
  }, [clearTimer, durationMs, onLongPress]);

  const onPointerEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const shouldBlockClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    onPointerDown,
    onPointerUp: onPointerEnd,
    onPointerLeave: onPointerEnd,
    onPointerCancel: onPointerEnd,
    shouldBlockClick,
  };
}
