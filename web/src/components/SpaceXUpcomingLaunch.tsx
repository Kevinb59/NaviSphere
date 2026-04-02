import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';

// 1) Purpose:
// - Afficher le prochain lancement SpaceX (Launch Library 2) + compte à rebours avec chiffres qui « tombent ».
// 2) Key variables: réponse API `results`, `targetMs` pour le timer, segments `DD - HH:MM:SS`.
// 3) Logic flow: fetch au montage → filtre fournisseur SpaceX → tick 1 s → chaque chiffre animé via `motion` si la valeur change.

const LL2_UPCOMING_URL =
  'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=5&ordering=net&search=SpaceX';

type LL2Launch = {
  name?: string;
  net?: string;
  mission?: { name?: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  pad?: { name?: string; location?: { name?: string } };
  launch_service_provider?: { name?: string };
};

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
function CountdownRolling({ text }: { text: string }) {
  const chars = useMemo(() => Array.from(text), [text]);
  return (
    <div
      className="mt-2 flex flex-wrap items-baseline text-[clamp(13px,2.8vw,15px)] leading-tight tracking-wide text-white/90"
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
        const launch = list.find((x) => x.launch_service_provider?.name === 'SpaceX');
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

  return (
    <div
      className="mt-4 text-left font-['Unica_One',sans-serif] text-[13px] leading-snug text-white/80"
      id="spacex-upcoming-launch"
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">UPCOMING LAUNCH</p>
      {loading && <p className="mt-2 text-white/50">Chargement…</p>}
      {!loading && error && <p className="mt-2 text-white/55">{error}</p>}
      {!loading && !error && (
        <>
          <p className="mt-2 text-white/88">{mission || '—'}</p>
          <p className="mt-1 text-white/72">{vehicle || '—'}</p>
          <p className="mt-1 text-white/65">
            {padName}
            {padName && locationName ? <br /> : null}
            {locationName}
          </p>
          {targetMs !== null && <CountdownRolling text={countdownText} />}
        </>
      )}
    </div>
  );
}
