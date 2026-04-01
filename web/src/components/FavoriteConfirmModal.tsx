import { motion } from 'framer-motion';
import { X } from 'lucide-react';

// 1) Purpose:
// - Modal léger pour confirmer l'ajout d'un service aux favoris (appui long dans les menus latéraux).
// 2) Key variables:
// - `appName`: libellé affiché; `onConfirm` / `onCancel`: actions utilisateur.
// 3) Logic flow:
// - Fond cliquable ferme; boutons explicites Confirmer / Annuler.

type FavoriteConfirmModalProps = {
  appName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function FavoriteConfirmModal({ appName, onConfirm, onCancel }: FavoriteConfirmModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        role="presentation"
        className="absolute inset-0 bg-black/15 backdrop-blur-[4px]"
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fav-confirm-title"
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-[1] w-full max-w-sm rounded-[18px] bg-[#11151b]/95 p-5 shadow-[0_32px_100px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
      >
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-3 top-3 rounded-full bg-white/8 p-2 text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.14]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Favoris</p>
          <h3 id="fav-confirm-title" className="mt-1 pr-8 text-lg font-medium text-white">
            Ajouter aux favoris ?
          </h3>
          <p className="mt-2 text-sm text-white/70">{appName}</p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-[12px] bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white/85 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-[12px] bg-white/[0.12] px-3 py-2.5 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/[0.18]"
            >
              Confirmer
            </button>
          </div>
      </motion.div>
    </motion.div>
  );
}
