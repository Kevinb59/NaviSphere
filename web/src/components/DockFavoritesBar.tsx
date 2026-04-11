import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLongPress } from '../hooks/useLongPress';

// 1) Purpose:
// - Afficher les favoris du dock avec appui long (mode édition) et glisser-déposer en mode édition.
// 2) Key variables:
// - `apps`: tuiles résolues dans l'ordre utilisateur; `editMode`: affiche croix + drag.
// 3) Logic flow:
// - Hors édition : clic = lien; appui long ~1,2 s = `onEnterEditMode`. En édition : croix supprime, drag réordonne.

export type CatalogTile = { name: string; domain: string; href: string; icon: LucideIcon };

// 1) Purpose:
// - Tuile dock : `favoriteKey` = id catalogue stocké dans `favoriteOrder` / Firestore (`favoriteIds`).
// 2) Key variables: `name` = libellé affiché (catalogue) ; `favoriteKey` = identifiant stable pour DnD + suppression.
// 3) Logic flow: le parent persiste la liste d’ids via `commitFavorites` après « Terminé ».
export type DockFavoriteTile = CatalogTile & { favoriteKey: string };

type SortableDockTileProps = {
  app: DockFavoriteTile;
  editMode: boolean;
  logoUrl: (domain: string) => string;
  onRemoveFavorite: (favoriteKey: string) => void;
  onEnterEditMode: () => void;
};

function SortableDockTile({
  app,
  editMode,
  logoUrl,
  onRemoveFavorite,
  onEnterEditMode,
}: SortableDockTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app.favoriteKey,
    disabled: !editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : 1,
  };

  const longPress = useLongPress({
    durationMs: 1200,
    onLongPress: () => {
      if (!editMode) onEnterEditMode();
    },
  });

  return (
    <div ref={setNodeRef} style={style} className="relative min-w-[122px] shrink-0">
      {editMode && (
        <button
          type="button"
          onPointerDownCapture={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemoveFavorite(app.favoriteKey);
          }}
          className="absolute -right-1 -top-1 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-rose-500/95 text-white shadow-md ring-1 ring-white/20 transition hover:bg-rose-400"
          aria-label={`Retirer ${app.name} des favoris`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div
        className={`rounded-[14px] ${editMode ? 'cursor-grab active:cursor-grabbing touch-none ring-1 ring-white/15' : ''}`}
        {...(editMode ? { ...attributes, ...listeners } : {})}
      >
        {!editMode ? (
          <div
            onPointerDown={longPress.onPointerDown}
            onPointerUp={longPress.onPointerUp}
            onPointerLeave={longPress.onPointerLeave}
            onPointerCancel={longPress.onPointerCancel}
          >
            <a
              href={app.href}
              onClick={(event) => {
                if (longPress.shouldBlockClick()) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              className="group flex min-w-[122px] flex-col items-center justify-center gap-2 rounded-[14px] bg-white/[0.085] p-3 ring-1 ring-white/10 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[0.11] hover:ring-white/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                <img
                  src={logoUrl(app.domain)}
                  alt={app.name}
                  className="h-full w-full rounded-xl object-contain"
                />
              </div>
              <span className="line-clamp-2 text-center text-xs font-medium text-white/90">{app.name}</span>
            </a>
          </div>
        ) : (
          <div className="flex min-w-[122px] flex-col items-center justify-center gap-2 rounded-[14px] bg-white/[0.085] p-3 ring-1 ring-white/10 backdrop-blur-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
              <img
                src={logoUrl(app.domain)}
                alt={app.name}
                className="h-full w-full rounded-xl object-contain"
              />
            </div>
            <span className="line-clamp-2 text-center text-xs font-medium text-white/90">{app.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

type DockFavoritesBarProps = {
  apps: DockFavoriteTile[];
  editMode: boolean;
  logoUrl: (domain: string) => string;
  onEnterEditMode: () => void;
  onRemoveFavorite: (favoriteKey: string) => void;
  onReorder: (orderedFavoriteKeys: string[]) => void;
};

export function DockFavoritesBar({
  apps,
  editMode,
  logoUrl,
  onEnterEditMode,
  onRemoveFavorite,
  onReorder,
}: DockFavoritesBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // 1) Purpose:
  // - Réordonner `favoriteOrder` côté parent via les ids favoris (pas les libellés catalogue).
  // 2) Key variables: `active.id` / `over.id` = `favoriteKey` dnd-kit.
  // 3) Logic flow: `arrayMove` sur la liste des clés → `onReorder` → brouillon puis `commitFavorites` au « Terminé ».
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const keys = apps.map((a) => a.favoriteKey);
    const oldIndex = keys.indexOf(String(active.id));
    const newIndex = keys.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(keys, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <SortableContext items={apps.map((a) => a.favoriteKey)} strategy={horizontalListSortingStrategy}>
        <div className="no-scrollbar dock-edge-fade flex gap-3 overflow-x-auto pb-1">
          {apps.map((app) => (
            <SortableDockTile
              key={app.favoriteKey}
              app={app}
              editMode={editMode}
              logoUrl={logoUrl}
              onRemoveFavorite={onRemoveFavorite}
              onEnterEditMode={onEnterEditMode}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
