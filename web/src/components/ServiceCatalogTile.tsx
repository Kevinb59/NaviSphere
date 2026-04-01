import { useLongPress } from '../hooks/useLongPress';

// 1) Purpose:
// - Tuile service dans les panneaux centraux : clic court = navigation, appui long ~1,2 s = ajout favoris.
// 2) Key variables:
// - `service`: nom, domaine, lien; `onLongPressIntent`: ouverture du modal de confirmation côté parent.
// 3) Logic flow:
// - `useLongPress` bloque le clic si un long press a été détecté pour éviter d'ouvrir le lien.

type ServiceLike = {
  name: string;
  domain: string;
  href: string;
};

type ServiceCatalogTileProps = {
  service: ServiceLike;
  logoUrl: (domain: string) => string;
  onLongPressIntent: () => void;
};

export function ServiceCatalogTile({ service, logoUrl, onLongPressIntent }: ServiceCatalogTileProps) {
  const longPress = useLongPress({
    durationMs: 1200,
    onLongPress: onLongPressIntent,
  });

  return (
    <div className="group flex h-32 flex-col justify-between rounded-[14px] bg-white/[0.055] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.09]">
      {/* 1) Purpose:
          - Lien principal : navigation si clic court; annulé si long press terminé.
          2) Key variables:
          - `shouldBlockClick`: renvoyé par le hook après un appui long.
          3) Logic flow:
          - Les événements pointer sont sur le lien pour capter tout le clic / appui long. */}
      <a
        href={service.href}
        onPointerDown={longPress.onPointerDown}
        onPointerUp={longPress.onPointerUp}
        onPointerLeave={longPress.onPointerLeave}
        onPointerCancel={longPress.onPointerCancel}
        onClick={(event) => {
          if (longPress.shouldBlockClick()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className="flex h-full flex-col justify-between"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          <img
            src={logoUrl(service.domain)}
            alt={service.name}
            className="h-full w-full rounded-xl object-contain"
          />
        </div>
        <p className="line-clamp-2 min-h-8 text-center text-xs font-medium text-white/85">{service.name}</p>
      </a>
    </div>
  );
}
