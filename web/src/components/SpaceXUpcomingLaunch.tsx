import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';

// 1) Purpose:
// - Afficher le prochain lancement SpaceX (Launch Library 2) + compte à rebours avec chiffres qui « tombent ».
// 2) Key variables: réponse API `results`, `targetMs` pour le timer, segments `DD - HH:MM:SS`.
// 3) Logic flow: fetch au montage → filtre fournisseur SpaceX → tick 1 s → chaque chiffre animé via `motion` si la valeur change.

// 1) Purpose:
// - `limit` un peu large : après filtre « date dans le futur », il peut rester peu d’entrées SpaceX.
// 2) Key variables: `ordering=net` = plus proche d’abord côté API ; on re-trie côté client après filtre.
// 3) Logic flow: voir `pickNextSpaceXLaunch`.
const LL2_UPCOMING_URL =
  'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=40&ordering=net&search=SpaceX';

type LL2Launch = {
  name?: string;
  net?: string;
  mission?: { name?: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  pad?: { name?: string; location?: { name?: string } };
  launch_service_provider?: { name?: string };
};

// 1) Purpose:
// - Cible fixe du bouton WATCH : page officielle des lancements SpaceX.
// 2) Key variables: `SPACEX_LAUNCHES_PAGE_URL` (https://www.spacex.com/launches).
// 3) Logic flow: lien constant, pas de dépendance aux `vid_urls` Launch Library.
const SPACEX_LAUNCHES_PAGE_URL = 'https://www.spacex.com/launches';

// 1) Purpose:
// - Choisir le **prochain** lancement SpaceX dont `net` est encore dans le futur (évite d’afficher celui d’il y a quelques heures).
// 2) Key variables: `nowMs` = référence temps (souvent `Date.now()` au moment du fetch).
// 3) Logic flow: filtre fournisseur + `net` valide et `> nowMs` → tri croissant sur `net` → premier.
function pickNextSpaceXLaunch(results: LL2Launch[], nowMs: number): LL2Launch | undefined {
  const candidates = results
    .filter((x) => x.launch_service_provider?.name === 'SpaceX')
    .map((launch) => {
      const t = launch.net ? new Date(launch.net).getTime() : NaN;
      return { launch, t };
    })
    .filter((x): x is { launch: LL2Launch; t: number } => Number.isFinite(x.t) && x.t > nowMs)
    .sort((a, b) => a.t - b.t);
  return candidates[0]?.launch;
}

// 1) Purpose:
// - Associer un schéma blueprint au lanceur (texte API) : Starship, Falcon Heavy ou Falcon 9.
// 2) Key variables: `vehicle` = `full_name` / `name` de la configuration fusée.
// 3) Logic flow: `starship` avant `heavy` pour éviter « Super Heavy » → illustration Falcon Heavy à tort.
function vehicleBlueprintSrc(vehicle: string): string | null {
  const v = vehicle.toLowerCase();
  if (v.includes('starship')) return '/assets/images/StarShip2.png';
  if (v.includes('heavy')) return '/assets/images/FalconHeavy.png';
  if (v.includes('9')) return '/assets/images/Falcon9.png';
  return null;
}

// 1) Purpose:
// - Formater le délai restant comme l’exemple utilisateur : `JJ - HH:MM:SS`.
// 2) Key variables: `totalSeconds` entier ≥ 0.
// 3) Logic flow: découpage j/h/m/s avec `padStart(2)`.
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = String(Math.floor(s / 86400)).padStart(2, '0');
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${d} - ${h}:${m}:${sec}`;
}

// 1) Purpose:
// - Un seul caractère du compte à rebours : chiffre animé (entrée par le bas), séparateurs statiques.
// 2) Key variables: `char` = caractère courant ; `slotIndex` = position stable pour la clé React.
// 3) Logic flow: si chiffre → `motion.span` avec `key={slot+char}` pour rejouer l’animation à chaque changement.
function CountdownRollChar({ char, slotIndex }: { char: string; slotIndex: number }) {
  if (!/[0-9]/.test(char)) {
    return (
      <span className="inline-block" aria-hidden={char === ' '}>
        {char === ' ' ? '\u00a0' : char}
      </span>
    );
  }

  return (
    <span className="relative inline-flex h-[1.25em] min-w-[0.52em] items-center justify-center overflow-hidden align-baseline leading-none">
      <motion.span
        key={`${slotIndex}-${char}`}
        initial={{ y: '100%', opacity: 0.35 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {char}
      </motion.span>
    </span>
  );
}

// 1) Purpose:
// - Ligne de compte à rebours découpée en caractères pour animer chaque chiffre indépendamment.
// 2) Key variables: `text` = chaîne `formatCountdown`.
// 3) Logic flow: `Array.from` → `CountdownRollChar` par index.
function CountdownRolling({ text, className = '' }: { text: string; className?: string }) {
  const chars = useMemo(() => Array.from(text), [text]);
  return (
    <div
      className={`flex flex-wrap items-baseline text-[clamp(16px,3.5vw,19px)] leading-tight tracking-wide text-white ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {chars.map((ch, i) => (
        <CountdownRollChar key={`slot-${i}`} char={ch} slotIndex={i} />
      ))}
    </div>
  );
}

// 1) Purpose:
// - Bloc texte sans cadre (police Unica One) pour le volet droit NaviSphere.
// 2) Key variables: états mission / lanceur / pad / erreur / chargement.
// 3) Logic flow: effet fetch LL2 → premier lancement SpaceX → timer 1 s.
export function SpaceXUpcomingLaunch() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mission, setMission] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [padName, setPadName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [targetMs, setTargetMs] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const tick = useCallback(() => setNowTick(Date.now()), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(LL2_UPCOMING_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { results?: LL2Launch[] };
        const list = data.results ?? [];
        const launch = pickNextSpaceXLaunch(list, Date.now());
        if (cancelled) return;
        if (!launch) {
          setError('Aucun lancement SpaceX à venir.');
          setMission('');
          setVehicle('');
          setPadName('');
          setLocationName('');
          setTargetMs(null);
          return;
        }
        const missionLabel = launch.mission?.name || launch.name || '';
        const rocketFull =
          launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '';
        setMission(missionLabel);
        setVehicle(rocketFull);
        setPadName(launch.pad?.name?.trim() || '');
        setLocationName(launch.pad?.location?.name?.trim() || '');
        const net = launch.net ? new Date(launch.net).getTime() : NaN;
        setTargetMs(Number.isFinite(net) ? net : null);
      } catch {
        if (!cancelled) setError('Données indisponibles.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (targetMs === null) return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetMs, tick]);

  const countdownText =
    targetMs === null ? '00 - 00:00:00' : formatCountdown((targetMs - nowTick) / 1000);

  const blueprintSrc = useMemo(() => (vehicle ? vehicleBlueprintSrc(vehicle) : null), [vehicle]);

  // 1) Purpose: marge gauche + typo ~×1,25 ; `min-w-0 max-w-full` pour que les images ne forcent pas la largeur de colonne.
  // 2) Key variables: `ml-3` / `md:ml-4`, `text-[16.25px]`.
  // 3) Logic flow: conteneur borné à la largeur du parent (même clamp que la colonne gauche dans App).
  return (
    <div
      className="mt-4 ml-3 min-w-0 max-w-full text-left font-['Unica_One',sans-serif] text-[16.25px] leading-snug text-white md:ml-4"
      id="spacex-upcoming-launch"
    >
      {/* 1) Purpose:
          - Logo SVG (bleu/gris d’origine) rendu blanc via `brightness-0 invert`, juste avant le titre.
          2) Key variables: hauteur ~25px (~+25 % vs 20px) pour rester proportionnel au corps agrandi.
          3) Logic flow: `flex-wrap` si le volet est très étroit. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <img
          src="/assets/images/tesla/SpaceX-Logo.svg"
          alt="SpaceX"
          className="h-[25px] w-auto max-w-full shrink-0 brightness-0 invert"
          draggable={false}
        />
        <p className="text-[13.75px] uppercase tracking-[0.24em] text-white">UPCOMING LAUNCH</p>
      </div>
      {loading && <p className="mt-2 text-white">Chargement…</p>}
      {!loading && error && <p className="mt-2 text-white">{error}</p>}
      {!loading && !error && (
        <>
          <p className="mt-2 text-white">{mission || '—'}</p>
          <p className="mt-1 text-white">{vehicle || '—'}</p>
          <p className="mt-1 text-white">
            {padName}
            {padName && locationName ? <br /> : null}
            {locationName}
          </p>
          {targetMs !== null && (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              {/* 1) Purpose:
                  - Compte à rebours + lien WATCH alignés en hauteur (police WATCH légèrement plus petite).
                  2) Key variables: `countdownText`, `SPACEX_LAUNCHES_PAGE_URL`.
                  3) Logic flow: `items-center` + `leading-none` sur le lien pour caler la bordure sur la ligne du timer. */}
              <CountdownRolling text={countdownText} className="min-w-0" />
              <a
                href={SPACEX_LAUNCHES_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md border border-white bg-transparent px-2.5 py-[0.28em] font-['Unica_One',sans-serif] text-[clamp(13px,2.85vw,16px)] uppercase leading-none tracking-[0.12em] text-white transition hover:bg-white/10"
              >
                WATCH
              </a>
            </div>
          )}
          {/* 1) Purpose:
              - Blueprint limité à la largeur utile de la colonne (pas de min-width intrinsèque qui élargit le layout).
              2) Key variables: `min-w-0` + `w-full` pour que `object-contain` réduise l’image si besoin.
              3) Logic flow: pas d’image si aucune règle ne matche. */}
          {blueprintSrc ? (
            <div className="mt-4 w-full min-w-0 max-w-full">
              <img
                src={blueprintSrc}
                alt=""
                className="h-auto w-full max-w-full object-contain object-left opacity-95"
                draggable={false}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
