import { AnimatePresence, motion } from 'framer-motion';
import { type FormEvent, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BatteryCharging,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Film,
  Gamepad2,
  LogOut,
  MessageSquare,
  Music2,
  Play,
  Radio,
  ScreenShare,
  Search,
  X,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { splitCatalogByBlockLengths, withUniqueIds } from './catalog/serviceIds';
import { formatFirebaseAuthError } from './firebase/authErrors';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase/client';
import { loadDockFavoriteIds, saveDockFavoriteIds } from './firebase/dockFavorites';
import { DockFavoritesBar } from './components/DockFavoritesBar';
import { FavoriteConfirmModal } from './components/FavoriteConfirmModal';
import { ServiceCatalogTile } from './components/ServiceCatalogTile';
import { SpaceXUpcomingLaunch } from './components/SpaceXUpcomingLaunch';
import { ViewportDebugOverlay } from './components/ViewportDebugOverlay';
import { Game2048 } from './games/Game2048';
import { MemoryGame } from './games/MemoryGame';
import { SnakeGame } from './games/SnakeGame';
import { TicTacToeGame } from './games/TicTacToeGame';
import { buildStarFieldNodes, buildWarpParticles } from './visuals/spaceFieldRandom';

// 1) Purpose:
// - Lien Tesla Theater : page YouTube intermédiaire puis ouverture de NaviSphere (`q=` encodé).
// 2) Key variables: `THEATER_ENTRY_URL` (cible finale) ; `FULLSCREEN_REDIRECT_URL` (youtube.com/redirect).
// 3) Logic flow: bouton « Plein écran » et tuile dock Fullscreen → `location.href` sur `FULLSCREEN_REDIRECT_URL`.
const THEATER_ENTRY_URL = 'https://navi-sphere.vercel.app/';
const FULLSCREEN_REDIRECT_URL = `https://www.youtube.com/redirect?q=${encodeURIComponent(THEATER_ENTRY_URL)}`;

// 1) Purpose:
// - Centraliser les services du dock (streaming, musique, etc.) pour filtres et favoris.
// 2) Key variables:
// - `name`: libellé affiché dans le dock.
// - `domain`: domaine utilisé pour récupérer le favicon.
// - `href`: URL de destination ouverte au clic.
// 3) Logic flow:
// - Le dock mappe ce tableau, et la recherche locale filtre ces mêmes entrées par nom/domaine.
const dockAppsRaw = [
  { name: 'Plex', domain: 'app.plex.tv', href: 'https://app.plex.tv', icon: Film },
  { name: 'myCanal', domain: 'canalplus.com', href: 'https://www.canalplus.com/', icon: Film },
  { name: 'Disney+', domain: 'disneyplus.com', href: 'https://www.disneyplus.com/fr-fr', icon: Film },
  { name: 'Apple TV+', domain: 'tv.apple.com', href: 'https://tv.apple.com/fr', icon: Film },
  { name: 'Prime Video', domain: 'primevideo.com', href: 'https://www.primevideo.com/', icon: Film },
  { name: 'Netflix', domain: 'netflix.com', href: 'https://www.netflix.com/fr', icon: Film },
  { name: 'YouTube', domain: 'youtube.com', href: 'https://www.youtube.com', icon: Play },
  { name: 'Paramount+', domain: 'paramountplus.com', href: 'https://www.paramountplus.com/fr/', icon: Film },
  { name: 'Gulli Replay', domain: 'replay.gulli.fr', href: 'https://replay.gulli.fr/Direct', icon: Film },
  { name: 'TNT en direct', domain: 'tntendirect.com', href: 'https://www.tntendirect.com', icon: Film },
  { name: 'Euronews Live', domain: 'euronews.com', href: 'https://fr.euronews.com/live', icon: Film },
  { name: 'LCI Direct', domain: 'lci.fr', href: 'https://www.lci.fr/direct/', icon: Film },
  { name: 'Free TV', domain: 'tv.free.fr', href: 'https://tv.free.fr/', icon: Film },
  { name: 'RTBF Auvio', domain: 'auvio.rtbf.be', href: 'https://auvio.rtbf.be/', icon: Film },
  { name: 'Pickx', domain: 'pickx.be', href: 'https://www.pickx.be/fr', icon: Film },
  { name: 'JustWatch', domain: 'justwatch.com', href: 'https://www.justwatch.com/fr', icon: Film },
  { name: 'Bouygues TV Direct', domain: 'bouyguestelecom.fr', href: 'https://www.bouyguestelecom.fr/tv-direct/', icon: Film },
  { name: 'FilmoTV', domain: 'filmotv.fr', href: 'https://www.filmotv.fr/', icon: Film },
  { name: 'ADN', domain: 'animedigitalnetwork.fr', href: 'https://animedigitalnetwork.fr/', icon: Film },
  { name: 'Molotov', domain: 'molotov.tv', href: 'https://app.molotov.tv/', icon: Film },
  { name: 'Eurosport', domain: 'eurosportplayer.com', href: 'https://www.eurosportplayer.com/', icon: Film },
  { name: 'RMC Sport', domain: 'rmcsport.tv', href: 'https://www.rmcsport.tv/', icon: Film },
  { name: 'Pluto TV', domain: 'pluto.tv', href: 'https://pluto.tv/fr/', icon: Film },
  { name: 'Crunchyroll', domain: 'crunchyroll.com', href: 'https://www.crunchyroll.com/fr', icon: Film },
  { name: 'OCS', domain: 'ocs.fr', href: 'https://www.ocs.fr/', icon: Film },
  { name: 'Twitch', domain: 'twitch.tv', href: 'https://www.twitch.tv/', icon: Play },
  { name: 'France TV', domain: 'france.tv', href: 'https://www.france.tv/', icon: Film },
  { name: 'TVPlayer', domain: 'tvplayer.com', href: 'https://tvplayer.com/FR/home', icon: Film },
  { name: 'NRJ Play', domain: 'nrj-play.fr', href: 'https://www.nrj-play.fr/', icon: Film },
  { name: 'SFR TV', domain: 'tv.sfr.fr', href: 'https://tv.sfr.fr/', icon: Film },
  { name: 'M6+', domain: '6play.fr', href: 'https://www.6play.fr/', icon: Film },
  { name: 'Orange TV', domain: 'chaines-tv.orange.fr', href: 'https://chaines-tv.orange.fr/', icon: Film },
  { name: 'Orange VOD', domain: 'video-a-la-demande.orange.fr', href: 'https://video-a-la-demande.orange.fr/', icon: Film },
  { name: 'Hayu', domain: 'hayu.com', href: 'https://www.hayu.com/', icon: Film },
  { name: 'LaCinetek', domain: 'lacinetek.com', href: 'https://www.lacinetek.com/fr', icon: Film },
  { name: 'INA madelen', domain: 'madelen.ina.fr', href: 'https://madelen.ina.fr/', icon: Film },
  { name: 'Rakuten TV', domain: 'rakuten.tv', href: 'https://rakuten.tv/fr', icon: Film },
  { name: 'MUBI', domain: 'mubi.com', href: 'https://mubi.com/fr', icon: Film },
  { name: 'WhatsUp TV', domain: 'whatsuptv.app', href: 'https://www.whatsuptv.app/', icon: Film },
  { name: 'Zattoo', domain: 'zattoo.com', href: 'https://zattoo.com/ch/fr', icon: Film },
  { name: 'Arte', domain: 'arte.tv', href: 'https://www.arte.tv/fr/', icon: Film },
  { name: 'BFM TV', domain: 'bfmtv.com', href: 'https://www.bfmtv.com/mediaplayer/live-video/', icon: Film },
  { name: 'CNEWS', domain: 'cnews.fr', href: 'https://www.cnews.fr/le-direct', icon: Film },
  { name: 'RTS Play', domain: 'rts.ch', href: 'https://www.rts.ch/play/tv', icon: Film },
  { name: 'Play Suisse', domain: 'playsuisse.ch', href: 'https://www.playsuisse.ch/fr', icon: Film },
  { name: 'Emby', domain: 'app.emby.media', href: 'http://app.emby.media/#!/home', icon: Film },
  { name: 'TF1+', domain: 'tf1.fr', href: 'https://www.tf1.fr/', icon: Film },
  { name: 'Crave', domain: 'crave.ca', href: 'https://www.crave.ca/fr', icon: Film },
  { name: 'Salt TV', domain: 'salt.ch', href: 'https://tv.salt.ch/', icon: Film },
  { name: 'VOO TV+', domain: 'tvplus.voo.be', href: 'https://tvplus.voo.be/fr/', icon: Film },
  { name: 'RTL Play', domain: 'rtlplay.be', href: 'https://www.rtlplay.be/', icon: Film },
  { name: 'Max', domain: 'max.com', href: 'https://www.max.com/fr/fr', icon: Film },
  { name: 'DAZN', domain: 'dazn.com', href: 'https://www.dazn.com/fr-FR/', icon: Film },
  { name: 'Jellyfin', domain: 'jellyfin.org', href: 'https://jellyfin.org/', icon: Film },
  { name: 'Ligue 1+', domain: 'plus.ligue1.com', href: 'https://plus.ligue1.com/', icon: Film },
  { name: 'Orange TV Go BE', domain: 'orangetvgo.be', href: 'https://orangetvgo.be/', icon: Film },
  { name: 'IPTV Smarters', domain: 'webtv.iptvsmarters.com', href: 'http://webtv.iptvsmarters.com/', icon: Film },
  { name: 'IPTV Smarters New', domain: 'webtv-new.iptvsmarters.com', href: 'http://webtv-new.iptvsmarters.com/', icon: Film },
  { name: 'Pleyr', domain: 'pleyr.net', href: 'https://pleyr.net/', icon: Film },
  { name: 'Spotify', domain: 'spotify.com', href: 'https://open.spotify.com/', icon: Music2 },
  { name: 'TuneIn', domain: 'tunein.com', href: 'https://tunein.com/', icon: Radio },
  { name: 'Cloud Gaming', domain: 'xbox.com', href: 'https://www.xbox.com/play', icon: Gamepad2 },
  { name: 'Fullscreen', domain: 'youtube.com', href: FULLSCREEN_REDIRECT_URL, icon: ScreenShare },
];

const quickMenuItems = [
  { title: 'Streaming', icon: Film },
  { title: 'Musique', icon: Music2 },
  { title: 'Jeux', icon: Gamepad2 },
  { title: 'Réseaux sociaux', icon: ScreenShare },
];

// 1) Purpose:
// - Mini-jeux intégrés à NaviSphere (développés dans ce dépôt) ; liste affichée dans l’encart gauche « Jeux NaviSphere ».
// 2) Key variables: `id` stable ; `title` ; `blurb` courte phrase pour la liste modale.
// 3) Logic flow: entrées avec `id` → `openGameId` ouvre le jeu dans le panneau central.
const navisphereGames: { id: string; title: string; blurb: string }[] = [
  { id: '2048', title: '2048', blurb: 'Fusionnez les tuiles jusqu’à 2048.' },
  { id: 'snake', title: 'Snake', blurb: 'Mangez les pommes, évitez de vous croiser.' },
  { id: 'memory', title: 'Memory', blurb: 'Retournez les cartes et retrouvez les paires.' },
  { id: 'morpion', title: 'Morpion', blurb: 'Alignez trois symboles — à deux ou contre la Tesla.' },
];

const musicServicesRaw = [
  { name: 'Apple Music', domain: 'music.apple.com', href: 'https://music.apple.com/fr/', icon: Music2 },
  { name: 'Amazon Music', domain: 'music.amazon.fr', href: 'https://music.amazon.fr/', icon: Music2 },
  { name: 'Deezer', domain: 'deezer.com', href: 'https://www.deezer.com/fr/', icon: Music2 },
  { name: 'Qobuz', domain: 'qobuz.com', href: 'https://www.qobuz.com/signin', icon: Music2 },
  { name: 'YouTube Music', domain: 'music.youtube.com', href: 'https://music.youtube.com/', icon: Music2 },
  { name: 'Spotify', domain: 'spotify.com', href: 'https://open.spotify.com/', icon: Music2 },
];

const gameServicesRaw = [
  { name: 'Xbox Cloud Gaming', domain: 'xbox.com', href: 'https://www.xbox.com/fr-FR/play', icon: Gamepad2 },
  { name: 'RetroGames', domain: 'retrogames.cc', href: 'https://www.retrogames.cc/', icon: Gamepad2 },
  { name: 'GameSnacks', domain: 'gamesnacks.com', href: 'https://gamesnacks.com/', icon: Gamepad2 },
  { name: 'WebRcade', domain: 'webrcade.com', href: 'https://www.webrcade.com/', icon: Gamepad2 },
  { name: 'Shadow PC', domain: 'shadow.tech', href: 'https://pc.shadow.tech/', icon: Gamepad2 },
  { name: 'Parsec', domain: 'parsec.app', href: 'https://web.parsec.app/', icon: Gamepad2 },
  { name: 'GeForce NOW', domain: 'geforcenow.com', href: 'https://play.geforcenow.com/mall/', icon: Gamepad2 },
  { name: 'Afterplay', domain: 'afterplay.io', href: 'https://afterplay.io/', icon: Gamepad2 },
];

const socialServicesRaw = [
  { name: 'X (Twitter)', domain: 'x.com', href: 'https://x.com/', icon: ScreenShare },
  { name: 'Facebook', domain: 'facebook.com', href: 'https://www.facebook.com/', icon: ScreenShare },
  { name: 'Instagram', domain: 'instagram.com', href: 'https://www.instagram.com/', icon: ScreenShare },
  { name: 'LinkedIn', domain: 'linkedin.com', href: 'https://www.linkedin.com/', icon: ScreenShare },
  { name: 'Pinterest', domain: 'pinterest.com', href: 'https://www.pinterest.com/', icon: ScreenShare },
  { name: 'Reddit', domain: 'reddit.com', href: 'https://www.reddit.com/', icon: ScreenShare },
  { name: 'TikTok', domain: 'tiktok.com', href: 'https://www.tiktok.com/', icon: ScreenShare },
  { name: 'Tumblr', domain: 'tumblr.com', href: 'https://www.tumblr.com/', icon: ScreenShare },
  { name: 'Threads', domain: 'threads.net', href: 'https://www.threads.net/', icon: ScreenShare },
  { name: 'Snapchat', domain: 'snapchat.com', href: 'https://www.snapchat.com/', icon: ScreenShare },
];

const communicationServicesRaw = [
  { name: 'Discord', domain: 'discord.com', href: 'https://discord.com/app', icon: MessageSquare },
  { name: 'Messenger', domain: 'messenger.com', href: 'https://www.messenger.com/', icon: MessageSquare },
  { name: 'Microsoft Teams', domain: 'teams.microsoft.com', href: 'https://teams.microsoft.com/', icon: MessageSquare },
  { name: 'Telegram', domain: 'web.telegram.org', href: 'https://web.telegram.org/', icon: MessageSquare },
  { name: 'WhatsApp Web', domain: 'web.whatsapp.com', href: 'https://web.whatsapp.com/', icon: MessageSquare },
];

const navigationServicesRaw = [
  { name: 'Apple Plans', domain: 'maps.apple.com', href: 'https://maps.apple.com/', icon: Compass },
  { name: 'Google Maps', domain: 'maps.google.com', href: 'https://maps.google.com/', icon: Compass },
  { name: 'HERE WeGo', domain: 'wego.here.com', href: 'https://wego.here.com/', icon: Compass },
  { name: 'Mappy', domain: 'mappy.com', href: 'https://fr.mappy.com/', icon: Compass },
  { name: 'OpenStreetMap', domain: 'openstreetmap.org', href: 'https://www.openstreetmap.org/', icon: Compass },
  { name: 'Sygic Maps', domain: 'maps.sygic.com', href: 'https://maps.sygic.com/', icon: Compass },
  { name: 'TomTom AmiGO', domain: 'tomtom.com', href: 'https://www.tomtom.com/products/amigo/', icon: Compass },
  { name: 'ViaMichelin', domain: 'viamichelin.fr', href: 'https://www.viamichelin.fr/', icon: Compass },
  { name: 'Waze', domain: 'waze.com', href: 'https://www.waze.com/', icon: Compass },
];

const chargingServicesRaw = [
  { name: 'A Better Routeplanner', domain: 'abetterrouteplanner.com', href: 'https://abetterrouteplanner.com/', icon: BatteryCharging },
  { name: 'Chargemap', domain: 'chargemap.com', href: 'https://fr.chargemap.com/', icon: BatteryCharging },
  { name: 'Chargeprice', domain: 'chargeprice.app', href: 'https://chargeprice.app/', icon: BatteryCharging },
  { name: 'Electra', domain: 'go-electra.com', href: 'https://www.go-electra.com/fr/', icon: BatteryCharging },
  { name: 'Fastned', domain: 'fastnedcharging.com', href: 'https://fastnedcharging.com/fr', icon: BatteryCharging },
  { name: 'Ionity', domain: 'ionity.eu', href: 'https://ionity.eu/fr', icon: BatteryCharging },
  { name: 'Izivia', domain: 'izivia.com', href: 'https://izivia.com/', icon: BatteryCharging },
  { name: 'Octopus Electroverse', domain: 'electroverse.com', href: 'https://electroverse.com/', icon: BatteryCharging },
  { name: 'PlugShare', domain: 'plugshare.com', href: 'https://www.plugshare.com/', icon: BatteryCharging },
  { name: 'Plugsurfing', domain: 'plugsurfing.com', href: 'https://plugsurfing.com/', icon: BatteryCharging },
  { name: 'Shell Recharge', domain: 'shellrecharge.com', href: 'https://shellrecharge.com/', icon: BatteryCharging },
  { name: 'Tesla Superchargeurs', domain: 'tesla.com', href: 'https://www.tesla.com/fr_fr/findus?v=2&bounds=71.97250152378777%2C26.135463211654304%2C34.10295415270172%2C-16.051060225845696&zoom=5&filters=supercharger%2Cparty', icon: BatteryCharging },
  { name: 'TotalEnergies EV Charge', domain: 'totalenergies.com', href: 'https://www.totalenergies.com/particuliers/electricite-et-gaz/solutions-recharge-vehicule-electrique', icon: BatteryCharging },
];

// 1) Purpose:
// - Fusionner tous les blocs puis attribuer des `id` uniques (slugs) pour le stockage Firestore des favoris.
// 2) Key variables: longueurs de blocs alignées sur l’ordre de concaténation.
// 3) Logic flow: `withUniqueIds` sur le plat → `splitCatalogByBlockLengths` reconstitue dock, musique, etc.
const CATALOG_BLOCK_LENGTHS = [
  dockAppsRaw.length,
  musicServicesRaw.length,
  gameServicesRaw.length,
  socialServicesRaw.length,
  communicationServicesRaw.length,
  navigationServicesRaw.length,
  chargingServicesRaw.length,
] as const;
const ALL_CATALOG_FLAT = withUniqueIds([
  ...dockAppsRaw,
  ...musicServicesRaw,
  ...gameServicesRaw,
  ...socialServicesRaw,
  ...communicationServicesRaw,
  ...navigationServicesRaw,
  ...chargingServicesRaw,
]);
const [
  dockApps,
  musicServices,
  gameServices,
  socialServices,
  communicationServices,
  navigationServices,
  chargingServices,
] = splitCatalogByBlockLengths(ALL_CATALOG_FLAT, [...CATALOG_BLOCK_LENGTHS]);
const ALL_CATALOG_SERVICES = ALL_CATALOG_FLAT;

// 1) Purpose:
// - Accès O(1) au service par identifiant stocké côté favoris (slug Firestore).
// 2) Key variables: clé = `id` (slug) ; valeur = entrée catalogue complète.
// 3) Logic flow: construit une seule fois au chargement du module.
const ALL_CATALOG_BY_ID = new Map(ALL_CATALOG_SERVICES.map((s) => [s.id, s]));

// 1) Purpose:
// - Convertir une valeur stockée (slug, ancien libellé, casse différente) en id canonique pour l’état React.
// 2) Key variables: `raw` = texte brut d’une colonne App* ; retour null si vide.
// 3) Logic flow: id connu → nom exact → nom insensible à la casse → sinon conserver la chaîne (orphelin).
function normalizeFavoriteSlot(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (ALL_CATALOG_BY_ID.has(t)) return t;
  const byExactName = ALL_CATALOG_SERVICES.find((s) => s.name === t);
  if (byExactName) return byExactName.id;
  const lower = t.toLowerCase();
  const byCi = ALL_CATALOG_SERVICES.find((s) => s.name.toLowerCase() === lower);
  if (byCi) return byCi.id;
  return t;
}

// 1) Purpose:
// - Produit la liste d’ids favoris (max 24, sans doublon, ordre conservé) après chargement Firestore.
// 2) Key variables: `cells` = tableau brut (ids / libellés issus du document `favoriteIds`).
// 3) Logic flow: pour chaque entrée, `normalizeFavoriteSlot` ; ignore les doublons successifs.
// 1) Purpose:
// - Représenter l’utilisateur connecté (Firebase Auth) pour la salutation et les garde-fous UI.
// 2) Key variables: `email` affiché ; l’`uid` reste dans `auth.currentUser` pour Firestore.
// 3) Logic flow: rempli par `onAuthStateChanged`, vidé à la déconnexion.
type SessionUser = { email: string };

function sessionDisplayName(session: SessionUser): string {
  return session.email;
}

function normalizeFavoritesFromSheet(cells: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const cell of cells) {
    const id = normalizeFavoriteSlot(cell);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 24) break;
  }
  return out;
}

// 1) Purpose:
// - Résoudre une clé dock (id favori ou ancien nom) vers métadonnées catalogue pour l’affichage.
// 2) Key variables: `favoriteKey` = id stocké ou chaîne héritée.
// 3) Logic flow: Map par id → égalité sur `name` → casse insensible.
function resolveCatalogEntryForFavoriteKey(favoriteKey: string) {
  const byId = ALL_CATALOG_BY_ID.get(favoriteKey);
  if (byId) return byId;
  const exact = ALL_CATALOG_SERVICES.find((s) => s.name === favoriteKey);
  if (exact) return exact;
  const lower = favoriteKey.toLowerCase();
  return ALL_CATALOG_SERVICES.find((s) => s.name.toLowerCase() === lower);
}

const rightMenuItems = [
  { title: 'Recharge', icon: BatteryCharging },
  { title: 'Navigation', icon: Compass },
  { title: 'Communication', icon: MessageSquare },
];

// 1) Purpose:
// - URLs des textures planètes dans `public/` (pas d’`import.meta.glob` sur `public/` → évite écran blanc Vite).
// 2) Key variables: indices alignés sur les fichiers réellement présents dans `public/assets/images/space/`.
// 3) Logic flow: liste explicite ; ajouter un numéro ici quand une nouvelle `planetN.png` est ajoutée.
const PLANET_TEXTURE_INDICES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const planetTextures = PLANET_TEXTURE_INDICES.map((n) => `/assets/images/space/planet${n}.png`);

function logoUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`;
}

// 1) Purpose:
// - Formater l’heure locale pour l’horloge d’en-tête (hors composant pour l’initialiseur `useState`).
// 2) Key variables: locale `fr-FR`, heure / minute / seconde à 2 chiffres.
// 3) Logic flow: appelé au premier rendu et chaque tick d’intervalle.
function formatCurrentTimeFr() {
  return new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TeslaFuturisticPortalConcept() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(() => formatCurrentTimeFr());
  const [isDockCollapsed, setIsDockCollapsed] = useState(true);
  const [activeCenterCategory, setActiveCenterCategory] = useState<string | null>(null);
  const [googleSearchQuery, setGoogleSearchQuery] = useState('');
  const [activeMeteor, setActiveMeteor] = useState<{
    id: string;
    left: number;
    top: number;
    angle: number;
    length: number;
    durationMs: number;
    travelPx: number;
  } | null>(null);
  const [activePlanet, setActivePlanet] = useState<{
    id: string;
    left: number;
    top: number;
    angle: number;
    travel: number;
    durationMs: number;
    size: number;
    hue: number;
    imageUrl: string;
  } | null>(null);

  // 1) Purpose:
  // - Gérer l'affichage des encarts Connexion / Inscription et leurs champs locaux.
  // 2) Key variables:
  // - `authModal`: `'login'` (connexion), `'register'` (inscription) ou `null` (fermé).
  // - `loginEmail` / `loginPassword`: connexion Firebase (e-mail + mot de passe).
  // - `registerEmail` / `registerPassword` / `registerPasswordConfirm`: idem pour l’inscription.
  // - `registerPasswordMismatch`: message si les deux mots de passe ne coïncident pas.
  // 3) Logic flow:
  // - Les boutons d'en-tête ouvrent le bon encart; fermeture = reset des champs pour ne rien laisser en mémoire côté UI.
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [registerPasswordMismatch, setRegisterPasswordMismatch] = useState(false);
  const [authFormError, setAuthFormError] = useState('');

  // 1) Purpose:
  // - Session Firebase : e-mail affiché + ordre des favoris (ids slugs, Firestore).
  // 2) Key variables:
  // - `sessionUser`: e-mail affiché quand Firebase Auth a une session active.
  // - `favoriteOrder`: ids favoris validés (Firestore / dernier commit dock).
  // - `dockDraftIds`: copie locale en mode édition (suppressions / ordre) jusqu’au clic « Terminé ».
  // - `dockEditMode`: édition (croix + glisser-déposer).
  // - `favoritePendingServiceId`: id catalogue du service en attente de confirmation d’ajout.
  // 3) Logic flow:
  // - Connexion / inscription via Firebase ; favoris lus/écrits dans Firestore.
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [favoriteOrder, setFavoriteOrder] = useState<string[]>([]);
  const [dockDraftIds, setDockDraftIds] = useState<string[] | null>(null);
  const [dockEditMode, setDockEditMode] = useState(false);
  const [favoritePendingServiceId, setFavoritePendingServiceId] = useState<string | null>(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  // 1) Purpose: ouvrir un mini-jeu NaviSphere (ex. 2048) en modale plein écran.
  // 2) Key variables: `id` aligné sur `navisphereGames`.
  // 3) Logic flow: choix dans la modale « Jeux NaviSphere » → id ; fermeture → null.
  const [openGameId, setOpenGameId] = useState<string | null>(null);
  // 1) Purpose: modale catalogue des jeux intégrés (liste + lancement), ouverte via « Ouvrir » dans la colonne gauche.
  // 2) Key variables: distinct de `openGameId` (le jeu plein écran se superpose après « Jouer »).
  // 3) Logic flow: Ouvrir → true ; overlay / X / lancement d’un jeu → false.
  const [navisphereGamesModalOpen, setNavisphereGamesModalOpen] = useState(false);
  const [dockBannerMessage, setDockBannerMessage] = useState('');

  const isLoggedIn = sessionUser !== null;
  const firebaseReady = isFirebaseConfigured();

  // 1) Purpose:
  // - Fermer les encarts d'authentification et effacer toute saisie locale (e-mail / mots de passe).
  // 2) Key variables:
  // - Aucun état dérivé: uniquement des réinitialisations via les setters React.
  // 3) Logic flow:
  // - On remet `authModal` à `null`, puis on vide chaque champ et l'indicateur d'erreur d'inscription.
  const closeAuthModal = useCallback(() => {
    setAuthModal(null);
    setLoginEmail('');
    setLoginPassword('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterPasswordConfirm('');
    setRegisterPasswordMismatch(false);
    setAuthFormError('');
  }, []);

  // 1) Purpose:
  // - Ouvrir Connexion ou Inscription avec des champs vierges à chaque ouverture.
  // 2) Key variables:
  // - `mode`: encart cible (`login` ou `register`).
  // 3) Logic flow:
  // - On réinitialise tous les champs puis on affiche l'encart demandé (évite de garder une saisie précédente).
  const openAuthModal = useCallback((mode: 'login' | 'register') => {
    setLoginEmail('');
    setLoginPassword('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterPasswordConfirm('');
    setRegisterPasswordMismatch(false);
    setAuthFormError('');
    setAuthModal(mode);
  }, []);

  // 1) Purpose:
  // - Synchroniser l’état React avec Firebase Auth (persistance navigateur) et charger les favoris Firestore.
  // 2) Key variables: `onAuthStateChanged` → `user.uid` pour `loadDockFavoriteIds`.
  // 3) Logic flow:
  // - Utilisateur présent → `sessionUser` + liste normalisée ; déconnexion → reset dock.
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        startTransition(() => {
          setSessionUser(null);
          setFavoriteOrder([]);
        });
        return;
      }
      void loadDockFavoriteIds(user.uid).then((ids) => {
        startTransition(() => {
          setSessionUser({
            email: user.email ?? user.uid,
          });
          setFavoriteOrder(normalizeFavoritesFromSheet(ids));
        });
      });
    });
    return () => unsubscribe();
  }, []);

  // 1) Purpose:
  // - Permettre de fermer Connexion / Inscription avec la touche Échap (accessibilité / usage véhicule).
  // 2) Key variables:
  // - `authModal`: n'écoute le clavier que lorsqu'un encart est ouvert.
  // 3) Logic flow:
  // - Si un encart est visible, `Escape` appelle `closeAuthModal`; sinon l'effet ne fait rien.
  useEffect(() => {
    if (!authModal) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAuthModal();
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [authModal, closeAuthModal]);

  // 1) Purpose:
  // - Rafraîchir l’horloge d’en-tête chaque seconde (valeur initiale via `useState(formatCurrentTimeFr)`).
  // 2) Key variables: `formatCurrentTimeFr` définie au niveau module.
  // 3) Logic flow: pas de `setState` synchrone dans l’effet — uniquement `setInterval` → callbacks asynchrones.
  useEffect(() => {
    const clockIntervalId = window.setInterval(() => {
      setCurrentTime(formatCurrentTimeFr());
    }, 1000);

    return () => window.clearInterval(clockIntervalId);
  }, []);

  // 1) Purpose:
  // - Désactiver le menu contextuel natif du navigateur (clic droit) sur toute l'application.
  // 2) Key variables:
  // - `disableContextMenu`: handler global de l'événement `contextmenu`.
  // 3) Logic flow:
  // - On attache un écouteur au `window` qui bloque l'action par défaut,
  //   puis on retire proprement cet écouteur au démontage.
  useEffect(() => {
    const disableContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    window.addEventListener('contextmenu', disableContextMenu);

    return () => {
      window.removeEventListener('contextmenu', disableContextMenu);
    };
  }, []);

  // 1) Purpose:
  // - Activer une recherche locale dans les contenus proposés (apps/sites/menu/récents).
  // 2) Key variables:
  // - `normalizedQuery`: requête normalisée en minuscules et trimée.
  // - `filteredDockApps`, `filteredQuickMenuItems`, `filteredRecents`: listes filtrées selon la recherche.
  // 3) Logic flow:
  // - Si la requête est vide, on garde toutes les données; sinon, on applique un `includes` sur les champs utiles.
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredDockApps = normalizedQuery
    ? dockApps.filter((app) => {
        return (
          app.name.toLowerCase().includes(normalizedQuery) ||
          app.domain.toLowerCase().includes(normalizedQuery)
        );
      })
    : dockApps;
  const filteredQuickMenuItems = normalizedQuery
    ? quickMenuItems.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
    : quickMenuItems;
  const filteredStreamingServices = filteredDockApps.filter(
    (app) => app.icon === Film || app.icon === Play,
  );
  const filteredMusicServices = normalizedQuery
    ? musicServices.filter((service) => {
        return (
          service.name.toLowerCase().includes(normalizedQuery) ||
          service.domain.toLowerCase().includes(normalizedQuery)
        );
      })
    : musicServices;
  const filteredGameServices = normalizedQuery
    ? gameServices.filter((service) => {
        return (
          service.name.toLowerCase().includes(normalizedQuery) ||
          service.domain.toLowerCase().includes(normalizedQuery)
        );
      })
    : gameServices;
  const filteredSocialServices = normalizedQuery
    ? socialServices.filter((service) => {
        return (
          service.name.toLowerCase().includes(normalizedQuery) ||
          service.domain.toLowerCase().includes(normalizedQuery)
        );
      })
    : socialServices;
  const filteredCommunicationServices = normalizedQuery
    ? communicationServices.filter((service) => {
        return (
          service.name.toLowerCase().includes(normalizedQuery) ||
          service.domain.toLowerCase().includes(normalizedQuery)
        );
      })
    : communicationServices;
  const filteredNavigationServices = normalizedQuery
    ? navigationServices.filter((service) => {
        return (
          service.name.toLowerCase().includes(normalizedQuery) ||
          service.domain.toLowerCase().includes(normalizedQuery)
        );
      })
    : navigationServices;
  const filteredChargingServices = normalizedQuery
    ? chargingServices.filter((service) => {
        return (
          service.name.toLowerCase().includes(normalizedQuery) ||
          service.domain.toLowerCase().includes(normalizedQuery)
        );
      })
    : chargingServices;

  // 1) Purpose:
  // - Générer les résultats de recherche dans un panneau central dédié.
  // 2) Key variables:
  // - `searchSourceServices`: base fusionnée des services Streaming/Musique/Jeux.
  // - `filteredSearchServices`: services dont le nom commence par la requête.
  // - `isSearchPanelOpen`: indique si le panneau de recherche doit être visible.
  // 3) Logic flow:
  // - On fusionne les services, on retire les doublons par nom, puis on filtre avec `startsWith`.
  const searchSourceServices = [
    ...dockApps,
    ...musicServices,
    ...gameServices,
    ...socialServices,
    ...communicationServices,
    ...navigationServices,
    ...chargingServices,
  ];
  const uniqueSearchServices = Array.from(
    new Map(searchSourceServices.map((service) => [service.name.toLowerCase(), service])).values(),
  );
  const filteredSearchServices = normalizedQuery
    ? uniqueSearchServices.filter((service) => service.name.toLowerCase().startsWith(normalizedQuery))
    : [];
  const isSearchPanelOpen = normalizedQuery.length > 0;

  // 1) Purpose:
  // - Uniformiser l'ordre d'affichage de tous les services par ordre alphabétique.
  // 2) Key variables:
  // - `sortServicesByName`: fonction de tri locale (fr) appliquée aux listes.
  // - `sorted*`: versions triées des listes filtrées.
  // 3) Logic flow:
  // - On copie chaque liste, puis on la trie avec `localeCompare` avant le rendu UI.
  const sortServicesByName = <T extends { name: string }>(services: T[]) => {
    return [...services].sort((firstService, secondService) =>
      firstService.name.localeCompare(secondService.name, 'fr', { sensitivity: 'base' }),
    );
  };

  // 1) Purpose:
  // - Dock : tuiles à partir du brouillon en édition ou des favoris commités.
  // 2) Key variables: `favoriteKey` = id catalogue (slug) pour DnD / suppression locale.
  // 3) Logic flow: résolution catalogue par id ou ancien nom ; repli visuel si orphelin.
  const favoriteDockApps = useMemo(() => {
    const ids = dockEditMode && dockDraftIds !== null ? dockDraftIds : favoriteOrder;
    return ids.map((favoriteKey) => {
      const found = resolveCatalogEntryForFavoriteKey(favoriteKey);
      if (found) {
        return { ...found, favoriteKey, name: found.name };
      }
      return {
        favoriteKey,
        name: favoriteKey,
        domain: 'google.com',
        href: 'https://www.google.com/',
        icon: Film,
      };
    });
  }, [dockDraftIds, dockEditMode, favoriteOrder]);
  const sortedStreamingServices = sortServicesByName(filteredStreamingServices);
  const sortedMusicServices = sortServicesByName(filteredMusicServices);
  const sortedGameServices = sortServicesByName(filteredGameServices);
  const sortedSocialServices = sortServicesByName(filteredSocialServices);
  const sortedCommunicationServices = sortServicesByName(filteredCommunicationServices);
  const sortedNavigationServices = sortServicesByName(filteredNavigationServices);
  const sortedChargingServices = sortServicesByName(filteredChargingServices);
  const sortedSearchServices = sortServicesByName(filteredSearchServices);

  // 1) Purpose:
  // - Fond d’étoiles pseudo-aléatoire figé au premier montage (pas de `Math.random` dans le rendu).
  // 2) Key variables: `starNodes` = données pour `.lightspeed-star-node` ; générées dans `spaceFieldRandom.ts`.
  // 3) Logic flow: `useState(() => buildStarFieldNodes(110))` exécute le tirage une fois par visite, conforme ESLint.
  const [starNodes] = useState(() => buildStarFieldNodes(110));


  // 1) Purpose:
  // - Déclencher des étoiles filantes rares, aléatoires, avec un intervalle minimum garanti.
  // 2) Key variables:
  // - `activeMeteor`: filante courante (ou `null` si aucune) ; `travelPx` = distance CSS `--meteor-travel`.
  // - `nextMeteorDelayMs`: délai jusqu'au prochain déclenchement (>= 45s).
  // 3) Logic flow:
  // - Une boucle de scheduling lance une filante, l'arrête après son animation (durée + marge),
  //   puis attend au moins 45s (plus un jitter aléatoire) avant la suivante.
  useEffect(() => {
    let nextMeteorTimerId: ReturnType<typeof setTimeout> | null = null;
    let clearMeteorTimerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextMeteor = () => {
      const nextMeteorDelayMs = 45000 + Math.random() * 25000;
      nextMeteorTimerId = window.setTimeout(() => {
        const durationMs = 2200 + Math.random() * 1300;
        // 1) Purpose: distance de translation sur le track (axe local) pour que la filante sorte du viewport.
        // 2) Key variables: hypoténuse fenêtre × marge, plage ~1400–2800 px (comme l’ordre des planètes).
        // 3) Logic flow: même idée que `travel` planète — évite la disparition avant le bord visible.
        const w = window.innerWidth;
        const h = window.innerHeight;
        const travelPx = Math.min(2800, Math.max(1400, Math.ceil(Math.hypot(w, h) * 1.38)));
        setActiveMeteor({
          id: `meteor-${Date.now()}`,
          left: 48 + (Math.random() * 8 - 4),
          top: 46 + (Math.random() * 10 - 5),
          angle: Math.random() * 360,
          length: 120 + Math.random() * 140,
          durationMs,
          travelPx,
        });

        clearMeteorTimerId = window.setTimeout(() => {
          setActiveMeteor(null);
          scheduleNextMeteor();
        }, durationMs + 320);
      }, nextMeteorDelayMs);
    };

    scheduleNextMeteor();

    return () => {
      if (nextMeteorTimerId) window.clearTimeout(nextMeteorTimerId);
      if (clearMeteorTimerId) window.clearTimeout(clearMeteorTimerId);
    };
  }, []);

  // 1) Purpose:
  // - Déclencher de temps en temps un "passage planète" pour accentuer l'effet de déplacement.
  // 2) Key variables:
  // - `activePlanet`: planète animée en cours (ou `null`).
  // - `nextPlanetDelayMs`: délai aléatoire avant le prochain passage.
  // - `travel`: distance de parcours en px, tirée entre 1200 et 1300.
  // 3) Logic flow:
  // - Une boucle planifie un passage, l'affiche pendant son animation, puis programme le suivant.
  useEffect(() => {
    let nextPlanetTimerId: ReturnType<typeof setTimeout> | null = null;
    let clearPlanetTimerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextPlanet = () => {
      if (planetTextures.length === 0) return;
      const nextPlanetDelayMs = 18000 + Math.random() * 28000;
      nextPlanetTimerId = window.setTimeout(() => {
        const durationMs = 5200 + Math.random() * 2600;
        const texturePick = planetTextures[Math.floor(Math.random() * planetTextures.length)]!;
        setActivePlanet({
          id: `planet-${Date.now()}`,
          left: 49 + (Math.random() * 4 - 2),
          top: 49 + (Math.random() * 4 - 2),
          angle: Math.random() * 360,
          travel: 1200 + Math.random() * 100,
          durationMs,
          size: 18 + Math.random() * 24,
          hue: 190 + Math.random() * 70,
          imageUrl: texturePick,
        });

        clearPlanetTimerId = window.setTimeout(() => {
          setActivePlanet(null);
          scheduleNextPlanet();
        }, durationMs + 120);
      }, nextPlanetDelayMs);
    };

    scheduleNextPlanet();

    return () => {
      if (nextPlanetTimerId) window.clearTimeout(nextPlanetTimerId);
      if (clearPlanetTimerId) window.clearTimeout(clearPlanetTimerId);
    };
  }, []);

  // 1) Purpose:
  // - Particules « warp » figées au montage ; tirage aléatoire délégué à `buildWarpParticles` (hors rendu React).
  // 2) Key variables: `warpParticles` = positions / angles / durées pour `.lightspeed-warp-particle`.
  // 3) Logic flow: `useState(() => buildWarpParticles(12))` comme pour le champ d’étoiles.
  const [warpParticles] = useState(() => buildWarpParticles(12));

  // 1) Purpose:
  // - Rediriger vers `youtube.com/redirect` pour le flux plein écran Tesla Theater.
  // 2) Key variables: `FULLSCREEN_REDIRECT_URL`.
  // 3) Logic flow: assignation `window.location.href` au clic sur « Plein écran ».
  const openTeslaFullscreen = () => {
    window.location.href = FULLSCREEN_REDIRECT_URL;
  };

  // 1) Purpose:
  // - Lancer une recherche Google depuis le panneau droit.
  // 2) Key variables:
  // - `googleSearchQuery`: texte saisi par l'utilisateur dans le champ dédié.
  // - `encodedGoogleQuery`: requête encodée pour l'URL Google.
  // 3) Logic flow:
  // - Au clic, on valide la saisie puis on redirige la page courante vers Google Search.
  const openGoogleSearch = () => {
    const trimmedQuery = googleSearchQuery.trim();
    if (!trimmedQuery) return;

    const encodedGoogleQuery = encodeURIComponent(trimmedQuery);
    window.location.href = `https://www.google.com/search?q=${encodedGoogleQuery}`;
  };

  // 1) Purpose:
  // - Piloter l'ouverture du panneau central selon la catégorie sélectionnée.
  // 2) Key variables:
  // - `menuItemTitle`: libellé du bouton de menu cliqué.
  // - `activeCenterCategory`: catégorie actuellement ouverte au centre.
  // 3) Logic flow:
  // - On ouvre Streaming, Musique, Jeux ou Réseaux sociaux dans l'espace central; sinon on ferme le panneau.
  const handleQuickMenuClick = (menuItemTitle: string) => {
    if (
      menuItemTitle === 'Streaming' ||
      menuItemTitle === 'Musique' ||
      menuItemTitle === 'Jeux' ||
      menuItemTitle === 'Réseaux sociaux'
    ) {
      setActiveCenterCategory((previousValue) =>
        previousValue === menuItemTitle ? null : menuItemTitle,
      );
      return;
    }

    setActiveCenterCategory(null);
  };

  // 1) Purpose:
  // - Ouvrir les catégories du panneau droit dans la zone centrale (Recharge, Navigation, Communication).
  // 2) Key variables:
  // - `menuItemTitle`: libellé du bouton droit cliqué.
  // - `activeCenterCategory`: catégorie actuellement affichée au centre.
  // 3) Logic flow:
  // - Si le bouton correspond à une catégorie supportée, on bascule son affichage; sinon on ferme.
  const handleRightMenuClick = (menuItemTitle: string) => {
    if (
      menuItemTitle === 'Recharge' ||
      menuItemTitle === 'Navigation' ||
      menuItemTitle === 'Communication'
    ) {
      setActiveCenterCategory((previousValue) =>
        previousValue === menuItemTitle ? null : menuItemTitle,
      );
      return;
    }

    setActiveCenterCategory(null);
  };

  // 1) Purpose:
  // - Persister tout l’ordre du dock (max 24 ids) dans Firestore pour l’utilisateur courant.
  // 2) Key variables: `ids` = ordre utilisateur (slugs après `normalizeFavoritesFromSheet`).
  // 3) Logic flow: compactage + dédup → `saveDockFavoriteIds` → mise à jour d’état locale si succès.
  const commitFavorites = useCallback(
    async (ids: string[]): Promise<boolean> => {
      if (!sessionUser) return false;
      const compact = normalizeFavoritesFromSheet(ids);
      setDockBannerMessage('');
      const auth = getFirebaseAuth();
      const user = auth?.currentUser;
      if (!user) {
        setDockBannerMessage('Session expirée : reconnectez-vous pour sauvegarder le dock.');
        return false;
      }
      try {
        await saveDockFavoriteIds(user.uid, compact);
        setFavoriteOrder(compact);
        return true;
      } catch (err) {
        setDockBannerMessage(
          err instanceof Error ? err.message : 'Erreur Firestore : impossible de sauvegarder le dock.',
        );
        return false;
      }
    },
    [sessionUser],
  );

  // 1) Purpose:
  // - Soumettre le formulaire de connexion Firebase (e-mail + mot de passe).
  // 2) Key variables: `loginEmail`, `loginPassword` ; `onAuthStateChanged` charge les favoris après succès.
  // 3) Logic flow: erreur config → message ; sinon `signInWithEmailAndPassword` puis fermeture modale.
  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthFormError('');
    if (!isFirebaseConfigured()) {
      setAuthFormError('Configuration manquante : renseignez les variables VITE_FIREBASE_* (voir web/.env.example).');
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthFormError('Firebase n’a pas pu être initialisé.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      closeAuthModal();
    } catch (err) {
      setAuthFormError(formatFirebaseAuthError(err));
    }
  };

  // 1) Purpose:
  // - Créer un compte Firebase (e-mail + mot de passe) et initialiser un dock vide dans Firestore.
  // 2) Key variables: `registerEmail`, `registerPassword` ; document `users/{uid}/settings/dock`.
  // 3) Logic flow: validation des mots de passe → `createUserWithEmailAndPassword` → `saveDockFavoriteIds([], ...)`.
  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthFormError('');
    if (registerPassword !== registerPasswordConfirm) {
      setRegisterPasswordMismatch(true);
      return;
    }
    setRegisterPasswordMismatch(false);
    if (!isFirebaseConfigured()) {
      setAuthFormError('Configuration manquante : renseignez les variables VITE_FIREBASE_* (voir web/.env.example).');
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthFormError('Firebase n’a pas pu être initialisé.');
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, registerEmail.trim(), registerPassword);
      await saveDockFavoriteIds(cred.user.uid, []);
      closeAuthModal();
    } catch (err) {
      setAuthFormError(formatFirebaseAuthError(err));
    }
  };

  // 1) Purpose:
  // - Réagir à un appui long sur une tuile catalogue : ouvrir login ou modal de confirmation favori.
  // 2) Key variables:
  // - `serviceName`: doit exister dans `ALL_CATALOG_SERVICES`.
  // 3) Logic flow:
  // - Contrôle doublon, plafond 24, puis `setFavoritePendingServiceId` pour le modal.
  const handleLongPressFavoriteIntent = useCallback(
    (serviceId: string) => {
      if (!sessionUser) {
        setAuthModal('login');
        return;
      }
      const currentDock = dockEditMode && dockDraftIds !== null ? dockDraftIds : favoriteOrder;
      if (currentDock.includes(serviceId)) {
        window.alert('Ce service est déjà dans vos favoris.');
        return;
      }
      if (currentDock.length >= 24) {
        window.alert('Vous avez atteint la limite de 24 favoris.');
        return;
      }
      setFavoritePendingServiceId(serviceId);
    },
    [dockDraftIds, dockEditMode, favoriteOrder, sessionUser],
  );

  // 1) Purpose:
  // - Confirmer l'ajout depuis le modal : en mode édition → brouillon seulement ; sinon un seul `setFavorites`.
  // 2) Key variables: `favoritePendingServiceId` = slug catalogue à ajouter.
  // 3) Logic flow: brouillon `dockDraftIds` ou `commitFavorites([...favoriteOrder, id])`.
  const confirmFavoriteAdd = useCallback(async () => {
    if (!favoritePendingServiceId || !sessionUser) return;
    const id = favoritePendingServiceId;
    setFavoritePendingServiceId(null);
    if (dockEditMode && dockDraftIds !== null) {
      if (dockDraftIds.length >= 24) {
        setDockBannerMessage('Dock plein (24 favoris maximum).');
        return;
      }
      if (dockDraftIds.includes(id)) {
        setDockBannerMessage('Ce favori est déjà dans le dock.');
        return;
      }
      setDockDraftIds([...dockDraftIds, id]);
      setDockBannerMessage('');
      return;
    }
    if (favoriteOrder.length >= 24) {
      setDockBannerMessage('Dock plein (24 favoris maximum).');
      return;
    }
    if (favoriteOrder.includes(id)) {
      setDockBannerMessage('Ce favori est déjà dans le dock.');
      return;
    }
    await commitFavorites([...favoriteOrder, id]);
  }, [commitFavorites, dockDraftIds, dockEditMode, favoriteOrder, favoritePendingServiceId, sessionUser]);

  // 1) Purpose:
  // - Retirer un favori en mode édition : uniquement le brouillon local (sync au « Terminé »).
  // 2) Key variables: `favoriteKey` = id stocké Sheet / `DockFavoriteTile.favoriteKey`.
  // 3) Logic flow: filtre sur `dockDraftIds` sans requête réseau.
  const handleRemoveFavoriteFromDock = useCallback(
    (favoriteKey: string) => {
      if (!dockEditMode || dockDraftIds === null) return;
      setDockDraftIds(dockDraftIds.filter((fid) => fid !== favoriteKey));
    },
    [dockDraftIds, dockEditMode],
  );

  // 1) Purpose:
  // - Mettre à jour l’ordre du brouillon après glisser-déposer (aucun appel réseau).
  // 2) Key variables: `orderedIds` = liste réordonnée des `favoriteKey`.
  // 3) Logic flow: `setDockDraftIds` si mode édition actif.
  const handleReorderDockFavorites = useCallback(
    (orderedIds: string[]) => {
      if (dockEditMode && dockDraftIds !== null) {
        setDockDraftIds(orderedIds);
      }
    },
    [dockDraftIds, dockEditMode],
  );

  // 1) Purpose:
  // - Une seule requête `setFavorites` pour réécrire C–Z, puis fermeture du mode édition.
  // 2) Key variables: `dockDraftIds` = liste éditée ; repli sur `favoriteOrder` si brouillon absent.
  // 3) Logic flow: `commitFavorites` ; en cas d’échec, on reste en édition pour réessayer.
  const handleDockEditDone = useCallback(async () => {
    if (!sessionUser) {
      setDockEditMode(false);
      setDockDraftIds(null);
      return;
    }
    const payload = dockDraftIds ?? favoriteOrder;
    const ok = await commitFavorites(payload);
    if (ok) {
      setDockEditMode(false);
      setDockDraftIds(null);
    }
  }, [commitFavorites, dockDraftIds, favoriteOrder, sessionUser]);

  // 1) Purpose:
  // - Terminer la session Firebase et réinitialiser l’état UI (dock, modals).
  // 2) Key variables: `signOut` sur `getFirebaseAuth()` si disponible.
  // 3) Logic flow: déconnexion Auth → reset états locaux → fermeture des encarts.
  const handleLogout = useCallback(() => {
    const auth = getFirebaseAuth();
    if (auth) void signOut(auth);
    setSessionUser(null);
    setFavoriteOrder([]);
    setDockEditMode(false);
    setDockDraftIds(null);
    setFavoritePendingServiceId(null);
    setHelpModalOpen(false);
    closeAuthModal();
  }, [closeAuthModal]);

  return (
    <div className="min-h-screen overflow-hidden bg-[#0b0d11] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_10%_20%,rgba(70,90,120,0.16),transparent_18%),radial-gradient(circle_at_90%_80%,rgba(55,75,95,0.16),transparent_20%)]" />
      <div className="fixed inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:34px_34px]" />

      <main className="relative h-screen w-full p-4 md:p-5">
        <div className="relative h-full overflow-hidden rounded-[24px] border border-white/10 bg-[#11151b] shadow-[0_40px_140px_rgba(0,0,0,0.48)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_40%)]" />

          <div
            className={`absolute inset-x-0 top-0 z-30 flex items-start justify-between px-5 py-4 md:px-7 ${
              openGameId ? 'hidden' : ''
            }`}
          >
            <div className="w-[clamp(208px,22vw,268px)]">
              <div className="flex items-center gap-3 rounded-full bg-black/25 px-4 py-2 ring-1 ring-white/10 backdrop-blur-xl">
                <Compass className="h-[clamp(19px,1.55vw,22px)] w-[clamp(19px,1.55vw,22px)] text-white/75" />
                <span className="tesla-wordmark translate-y-[1px] text-[clamp(1.08rem,1.55vw,1.45rem)] font-medium leading-none text-white/85">
                  NaviSphere
                </span>
              </div>
              {/* 1) Purpose:
                  - Afficher connexion / inscription ou salutation + aide / déconnexion selon l’état session.
                  2) Key variables:
                  - `sessionDisplayName(sessionUser)`: e-mail affiché depuis Firebase Auth.
                  3) Logic flow:
                  - Si connecté : ligne avec salutation tronquée et deux boutons icônes; sinon capsules Connexion / Inscription. */}
              {isLoggedIn && sessionUser ? (
                <div className="mt-2 flex items-center gap-2">
                  <p
                    className="min-w-0 flex-1 truncate rounded-full bg-black/25 px-3 py-2 text-xs font-medium text-white/85 ring-1 ring-white/10 backdrop-blur-xl"
                    title={sessionDisplayName(sessionUser)}
                  >
                    Bonjour, {sessionDisplayName(sessionUser)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setHelpModalOpen(true)}
                    className="rounded-full bg-black/25 p-2 text-white/75 ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/[0.12]"
                    aria-label="Aide"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full bg-black/25 p-2 text-white/75 ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/[0.12]"
                    aria-label="Déconnexion"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    disabled={!firebaseReady}
                    className="flex-1 rounded-full bg-black/25 px-3 py-2 text-xs font-medium text-white/80 ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal('register')}
                    disabled={!firebaseReady}
                    className="flex-1 rounded-full bg-black/25 px-3 py-2 text-xs font-medium text-white/80 ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Inscription
                  </button>
                </div>
              )}
              {!firebaseReady && (
                <p className="mt-2 rounded-[10px] bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-100/90 ring-1 ring-amber-400/20">
                  Firebase non configuré : copiez <span className="font-mono text-[10px]">web/.env.example</span> vers{' '}
                  <span className="font-mono text-[10px]">.env.local</span> et renseignez les variables{' '}
                  <span className="font-mono text-[10px]">VITE_FIREBASE_*</span>, puis relancez{' '}
                  <span className="font-mono text-[10px]">npm run dev</span>.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openTeslaFullscreen}
                className="hidden items-center gap-2 rounded-full bg-black/25 px-3 py-2 text-sm text-white/70 ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/[0.12] md:flex"
              >
                <ScreenShare className="h-4 w-4" />
                Plein écran
              </button>
              <div className="hidden items-center gap-2 rounded-full bg-black/25 px-3 py-2 text-sm text-white/70 ring-1 ring-white/10 backdrop-blur-xl md:flex">
                <Clock3 className="h-4 w-4" />
                {currentTime}
              </div>
            </div>
          </div>

          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#181d24_0%,#12171d_48%,#10151b_100%)]" />
            {/* 1) Purpose:
                - Champ étoiles / nébuleuses / planètes légèrement assourdi (~88 %) pour lisibilité Tesla tout en gardant le vaisseau au-dessus net.
                2) Key variables: `z-[5]` sous le starship (`z-[15]`) et sous halo (`z-[25]`).
                3) Logic flow: le vaisseau et le halo sont des frères séparés pour opacités indépendantes. */}
            <div className="pointer-events-none absolute inset-0 z-[5] opacity-[0.88]">
              {/* Etoiles scintillantes */}
              <div className="lightspeed-starfield z-[5]">
                {starNodes.map((star) => (
                  <span
                    key={star.id}
                    className="lightspeed-star-node"
                    style={{
                      left: `${star.left}%`,
                      top: `${star.top}%`,
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      opacity: star.opacity,
                      animationDuration: `${star.duration}s`,
                      animationDelay: `${star.delay}s`,
                    }}
                  />
                ))}
              </div>

              {/* Nuages / gaz */}
              <div className="milkyway-band z-[10]" />
              <div className="milkyway-dust z-[11]" />
              <div className="nebula-layer-a z-[12]" />
              <div className="nebula-layer-b z-[13]" />

              {/* Particules */}
              <div className="lightspeed-starfield z-[20]">
                {warpParticles.map((particle) => (
                  <span
                    key={particle.id}
                    className="lightspeed-warp-track"
                    style={{
                      left: `${particle.left}%`,
                      top: `${particle.top}%`,
                      transform: `rotate(${particle.angle}deg)`,
                    }}
                  >
                    <span
                      className="lightspeed-warp-particle"
                      style={{
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        animationDuration: `${particle.duration}s`,
                        animationDelay: `${particle.delay}s`,
                        ['--warp-distance' as string]: `${particle.distance}px`,
                      }}
                    />
                  </span>
                ))}
              </div>

              {/* Etoiles filantes */}
              <div className="lightspeed-starfield z-[30]">
                {activeMeteor && (
                  <span
                    key={activeMeteor.id}
                    className="lightspeed-meteor-track"
                    style={{
                      left: `${activeMeteor.left}%`,
                      top: `${activeMeteor.top}%`,
                      transform: `rotate(${activeMeteor.angle}deg)`,
                    }}
                  >
                    <span
                      className="lightspeed-meteor"
                      style={{
                        width: `${activeMeteor.length}px`,
                        animationDuration: `${activeMeteor.durationMs}ms`,
                        animationDelay: '0ms',
                        ['--meteor-travel' as string]: `${activeMeteor.travelPx}px`,
                      }}
                    />
                  </span>
                )}
              </div>

              {/* Planètes */}
              <div className="lightspeed-starfield z-[40]">
                {activePlanet && (
                  <span
                    key={activePlanet.id}
                    className="planet-pass-track"
                    style={{
                      left: `${activePlanet.left}%`,
                      top: `${activePlanet.top}%`,
                      transform: `rotate(${activePlanet.angle}deg)`,
                    }}
                  >
                    {/* 1) Purpose:
                        - Rendre un passage planète ponctuel pour simuler qu'on la dépasse.
                        2) Key variables:
                        - `--planet-travel`, `--planet-size`, `--planet-hue`: trajectoire, taille et teinte dynamiques.
                        3) Logic flow:
                        - La planète naît près du centre, avance vers l'extérieur, grossit et disparaît. */}
                    <span
                      className="planet-pass-body"
                      style={{
                        animationDuration: `${activePlanet.durationMs}ms`,
                        ['--planet-travel' as string]: `${activePlanet.travel}px`,
                        ['--planet-size' as string]: `${activePlanet.size}px`,
                        ['--planet-hue' as string]: `${activePlanet.hue}`,
                        ['--planet-image' as string]: `url('${activePlanet.imageUrl}')`,
                      }}
                    />
                  </span>
                )}
              </div>
            </div>

            {/* 1) Purpose:
                - Vaisseau en opacité pleine (hors calque 80 %) pour masquer nettement les planètes qui passent derrière.
                2) Key variables: PNG 1000×500 ; `isolation-isolate` + `mix-blend-normal` pour éviter tout mélange avec les couches animées.
                3) Logic flow: frère du bloc `opacity-80` ; `z-[15]` au-dessus des planètes (dans le calque 80 %). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] flex items-end justify-center [isolation:isolate]">
              <img
                src="/assets/images/starship.png"
                alt=""
                width={1000}
                height={500}
                className="h-auto w-[1000px] max-w-full select-none object-contain object-bottom mix-blend-normal opacity-100"
                draggable={false}
              />
            </div>

            {/* 1) Purpose:
                - Halo + vignette comme avant (ré-appliquer ~80 % sur le groupe pour conserver la luminosité globale).
                2) Key variables: `z-[25]` au-dessus du vaisseau.
                3) Logic flow: `mix-blend-mode: screen` sur `.speed-edge-aura` reste inchangé dans `index.css`. */}
            <div className="pointer-events-none absolute inset-0 z-[25] opacity-80">
              <div className="speed-edge-aura" />
              <div className="speed-center-vignette" />
            </div>

            <div className="absolute left-[6%] top-[16%] h-[58%] w-[44%] rotate-[12deg] rounded-[26px] border border-white/5 bg-[radial-gradient(circle,rgba(255,255,255,0.05),transparent_62%)] blur-2xl" />
            <div className="absolute right-[2%] top-[8%] h-[48%] w-[36%] rounded-[26px] bg-[radial-gradient(circle,rgba(120,145,170,0.10),transparent_58%)] blur-3xl" />
          </div>

          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: openGameId ? 0 : 1, x: openGameId ? -24 : 0 }}
            transition={{ duration: 0.28 }}
            className={`absolute left-4 top-24 z-20 w-[clamp(208px,22vw,268px)] max-w-[calc(100%-2rem)] space-y-4 md:left-6 md:top-28 ${
              openGameId ? 'hidden' : ''
            }`}
          >
            <div className="rounded-[18px] bg-black/30 p-4 ring-1 ring-white/10 backdrop-blur-2xl">
              <div className="mb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Recherche</p>
                </div>
              </div>

              {/* 1) Purpose:
                  - Fournir un champ de recherche simple et direct.
                  2) Key variables:
                  - `value`: contenu saisi dans l'input lié à `searchQuery`.
                  - `onChange`: met à jour `searchQuery` en temps réel.
                  3) Logic flow:
                  - L'utilisateur saisit un texte, puis les listes de contenus sont filtrées instantanément. */}
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-[12px] bg-black/30 px-3 py-3 ring-1 ring-white/10">
                  <Search className="h-4 w-4 text-white/60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Rechercher une app ou un site..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[18px] bg-black/30 p-4 ring-1 ring-white/10 backdrop-blur-2xl">
              <div className="mb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Accès rapides</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* 1) Purpose:
                    - Afficher un menu court avec les 3 univers principaux.
                    2) Key variables:
                    - `filteredQuickMenuItems`: éléments visibles après recherche locale.
                    - `item.title` / `item.icon`: libellé et icône de chaque entrée.
                    3) Logic flow:
                    - On mappe la liste filtrée et on rend un bouton stylé par entrée. */}
                {filteredQuickMenuItems.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleQuickMenuClick(item.title)}
                    className={`w-full rounded-[14px] px-4 py-3 text-left text-sm font-medium text-white ring-1 transition ${
                      item.title === activeCenterCategory
                        ? 'bg-white/[0.16] ring-white/30'
                        : 'bg-white/[0.055] ring-white/10 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-white/80" />
                      {item.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] bg-black/30 p-4 ring-1 ring-white/10 backdrop-blur-2xl">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Recherche Google</p>
              {/* 1) Purpose:
                  - Recherche web via Google depuis la colonne gauche, sous les accès rapides.
                  2) Key variables: `googleSearchQuery`, `openGoogleSearch`.
                  3) Logic flow: saisie + bouton ou Entrée → redirection Google. */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 rounded-[12px] bg-black/30 px-3 py-3 ring-1 ring-white/10">
                  <Search className="h-4 w-4 text-white/60" />
                  <input
                    type="text"
                    value={googleSearchQuery}
                    onChange={(event) => setGoogleSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') openGoogleSearch();
                    }}
                    placeholder="Rechercher sur Google..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={openGoogleSearch}
                  className="w-full rounded-[12px] bg-white/[0.09] px-3 py-2 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/[0.14]"
                >
                  Rechercher
                </button>
              </div>
            </div>

            <div className="rounded-[18px] bg-black/30 p-4 ring-1 ring-white/10 backdrop-blur-2xl">
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Jeux NaviSphere</p>
              </div>
              {/* 1) Purpose:
                  - Même interaction que les accès rapides (Streaming, Musique…) : bouton « Ouvrir » → modale catalogue.
                  2) Key variables: `navisphereGamesModalOpen` pour l’état actif du bouton ; jeux dans `navisphereGames`.
                  3) Logic flow: clic Ouvrir → modale liste ; Jouer sur une entrée → ferme le catalogue et ouvre le jeu. */}
              <button
                type="button"
                onClick={() => setNavisphereGamesModalOpen(true)}
                className={`w-full rounded-[14px] px-4 py-3 text-left text-sm font-medium text-white ring-1 transition ${
                  navisphereGamesModalOpen
                    ? 'bg-white/[0.16] ring-white/30'
                    : 'bg-white/[0.055] ring-white/10 hover:bg-white/[0.08]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-white/80" aria-hidden />
                  Ouvrir
                </span>
              </button>
            </div>
          </motion.div>

          {/* 1) Purpose: même largeur que la colonne gauche ; les images SpaceX s’adaptent en largeur (pas d’élargissement).
              2) Key variables: `clamp(208px,22vw,268px)` identique au volet gauche + `max-w-[calc(100%-2rem)]` sur petits écrans.
              3) Logic flow: `right-[calc(...)]` du panneau central reprend le même clamp. */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: openGameId ? 0 : 1, x: openGameId ? 24 : 0 }}
            transition={{ duration: 0.28, delay: openGameId ? 0 : 0.08 }}
            className={`absolute right-4 top-20 z-20 w-[clamp(208px,22vw,268px)] max-w-[calc(100%-2rem)] space-y-4 md:right-6 ${
              openGameId ? 'hidden' : ''
            }`}
          >
            <div className="rounded-[18px] bg-black/30 p-4 ring-1 ring-white/10 backdrop-blur-2xl">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Accès véhicule</p>
              <div className="mt-3 space-y-3">
                {/* 1) Purpose:
                    - Remplacer le faux lecteur par un menu rapide orienté usage véhicule.
                    2) Key variables:
                    - `rightMenuItems`: éléments à afficher à droite.
                    - `item.title` / `item.icon`: libellé et icône de chaque bouton.
                    3) Logic flow:
                    - On mappe une liste courte et on rend des boutons homogènes alignés verticalement. */}
                {rightMenuItems.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleRightMenuClick(item.title)}
                    className={`w-full rounded-[14px] px-4 py-3 text-left text-sm font-medium text-white ring-1 transition ${
                      item.title === activeCenterCategory
                        ? 'bg-white/[0.16] ring-white/30'
                        : 'bg-white/[0.055] ring-white/10 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-white/80" />
                      {item.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 1) Purpose:
                - Prochain lancement SpaceX (Launch Library 2), sous Accès véhicule, police Unica One.
                2) Key variables: composant autonome fetch + compte à rebours animé.
                3) Logic flow: pas de cadre ; API publique côté client (CORS selon navigateur). */}
            <SpaceXUpcomingLaunch />
          </motion.div>

          <AnimatePresence>
            {(isSearchPanelOpen || activeCenterCategory || openGameId) && (
              <motion.div
                key={openGameId ? `game-${openGameId}` : 'center-panel'}
                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.985 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className={
                  openGameId
                    ? 'absolute inset-x-4 top-4 bottom-4 z-30 flex min-h-0 flex-col rounded-none border-0 bg-transparent p-2 shadow-none ring-0 md:inset-x-6 md:p-3'
                    : 'absolute left-[calc(1.5rem+clamp(208px,22vw,268px)+0.5rem)] right-[calc(1rem+clamp(208px,22vw,268px)+0.5rem)] top-4 bottom-[10%] z-30 rounded-[20px] bg-black/30 p-5 ring-1 ring-white/10 backdrop-blur-2xl'
                }
              >
                {/* 1) Purpose:
                    - Catalogues : panneau flou entre les colonnes. Jeu : plein écran utilisable (bottom-4 car dock masqué), sans bordure.
                    2) Key variables:
                    - `openGameId` : header + dock + colonnes cachés ; bouton Fermer seul en surimpression.
                    3) Logic flow:
                    - Fermer : jeu → recherche → catégorie. */}
                {openGameId && (
                  <button
                    type="button"
                    onClick={() => setOpenGameId(null)}
                    className="absolute right-2 top-2 z-50 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-3 py-2 text-xs font-medium text-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-black/50 md:right-3 md:top-3"
                    aria-label="Fermer le jeu"
                  >
                    <X className="h-4 w-4" />
                    Fermer
                  </button>
                )}

                {!openGameId && (
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">
                        {isSearchPanelOpen ? 'Recherche' : activeCenterCategory}
                      </p>
                      <h3 className="mt-1 text-lg font-medium text-white">
                        {isSearchPanelOpen
                          ? 'Résultats'
                          : activeCenterCategory === 'Musique'
                            ? 'Services musicaux'
                            : activeCenterCategory === 'Jeux'
                              ? 'Services de jeux'
                              : activeCenterCategory === 'Réseaux sociaux'
                                ? 'Plateformes sociales'
                                : activeCenterCategory === 'Communication'
                                  ? 'Services de communication'
                                  : activeCenterCategory === 'Navigation'
                                    ? 'Services de navigation'
                                    : activeCenterCategory === 'Recharge'
                                      ? 'Services de recharge'
                                      : 'Services vidéo'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (isSearchPanelOpen) {
                          setSearchQuery('');
                          return;
                        }
                        setActiveCenterCategory(null);
                      }}
                      className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10 transition hover:bg-white/[0.14]"
                    >
                      <X className="h-4 w-4" />
                      Fermer
                    </button>
                  </div>
                )}

                {openGameId === '2048' ? (
                  <div
                    className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto pt-10 pb-4"
                    role="region"
                    aria-labelledby="game-2048-title"
                  >
                    <span id="game-2048-title" className="sr-only">
                      2048
                    </span>
                    <Game2048 />
                  </div>
                ) : openGameId === 'snake' ? (
                  <div
                    className="flex min-h-0 flex-1 flex-col overflow-hidden pt-10"
                    role="region"
                    aria-labelledby="game-snake-title"
                  >
                    <span id="game-snake-title" className="sr-only">
                      Snake
                    </span>
                    <SnakeGame />
                  </div>
                ) : openGameId === 'memory' ? (
                  <div
                    className="flex min-h-0 flex-1 flex-col overflow-hidden pt-10"
                    role="region"
                    aria-labelledby="game-memory-title"
                  >
                    <span id="game-memory-title" className="sr-only">
                      Memory
                    </span>
                    <MemoryGame />
                  </div>
                ) : openGameId === 'morpion' ? (
                  <div
                    className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-10 pb-4"
                    role="region"
                    aria-labelledby="game-morpion-title"
                  >
                    <span id="game-morpion-title" className="sr-only">
                      Morpion
                    </span>
                    <TicTacToeGame />
                  </div>
                ) : (
                  <div className="relative h-[calc(100%-56px)]">
                    <div className="no-scrollbar center-scroll-fade grid h-full content-start grid-cols-2 gap-3 overflow-y-auto pr-1 pb-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {(isSearchPanelOpen
                        ? sortedSearchServices
                        : activeCenterCategory === 'Musique'
                          ? sortedMusicServices
                          : activeCenterCategory === 'Jeux'
                            ? sortedGameServices
                            : activeCenterCategory === 'Réseaux sociaux'
                              ? sortedSocialServices
                              : activeCenterCategory === 'Communication'
                                ? sortedCommunicationServices
                                : activeCenterCategory === 'Navigation'
                                  ? sortedNavigationServices
                                  : activeCenterCategory === 'Recharge'
                                    ? sortedChargingServices
                          : sortedStreamingServices
                      ).map((service) => (
                        <ServiceCatalogTile
                          key={service.id}
                          service={service}
                          logoUrl={logoUrl}
                          onLongPressIntent={() => handleLongPressFavoriteIntent(service.id)}
                        />
                      ))}
                      {isSearchPanelOpen && sortedSearchServices.length === 0 && (
                        <div className="col-span-full rounded-[14px] bg-white/[0.055] p-4 text-sm text-white/65 ring-1 ring-white/10">
                          Aucun service ne commence par "{searchQuery.trim()}".
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={`absolute inset-x-0 bottom-0 z-50 flex flex-col items-center p-4 pt-2 md:p-5 md:pt-3 ${
              openGameId ? 'hidden' : ''
            }`}
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.14 }}
              className={`w-full rounded-[20px] bg-black/34 ring-1 ring-white/10 backdrop-blur-2xl ${
                isDockCollapsed ? 'px-4 py-3 md:px-5 md:py-3' : 'p-4 md:p-5'
              }`}
            >
              <div
                className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${isDockCollapsed ? 'mb-0' : 'mb-4'}`}
              >
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Dock applications</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* 1) Purpose:
                      - Réduire / développer la zone sous le titre (message invité ou liste d'apps).
                      2) Key variables:
                      - `isDockCollapsed`: dock compact par défaut; développer pour voir le contenu.
                      3) Logic flow:
                      - Même comportement qu'avant : repli commun; contenu affiché seulement si non réduit. */}
                  {dockEditMode && isLoggedIn && (
                    <button
                      type="button"
                      onClick={() => void handleDockEditDone()}
                      className="rounded-full bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-100 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/30"
                    >
                      Terminer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDockCollapsed((previousValue) => !previousValue)}
                    className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-xs text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.14]"
                  >
                    {isDockCollapsed ? 'Développer' : 'Réduire'}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isDockCollapsed ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              <div
                className={`relative overflow-hidden transition-all duration-300 ${isDockCollapsed ? 'max-h-0 opacity-0' : 'max-h-52 opacity-100'}`}
              >
                {/* 1) Purpose:
                    - Contenu du dock développé : message invité, favoris (édition / glisser-déposer), ou vide.
                    2) Key variables:
                    - `favoriteDockApps`: tous les favoris (recherche globale ne filtre pas le dock, pour ne pas corrompre le drag).
                    3) Logic flow:
                    - Visible uniquement quand le dock n'est pas réduit (`!isDockCollapsed`). */}
                <div className="no-scrollbar dock-edge-fade min-h-[52px] px-0.5 pb-2 pt-1">
                  {dockBannerMessage && (
                    <div
                      className="mb-2 rounded-[12px] bg-amber-500/15 px-3 py-2 text-xs leading-snug text-amber-100 ring-1 ring-amber-400/25"
                      role="status"
                    >
                      {dockBannerMessage}
                    </div>
                  )}
                  {!isLoggedIn ? (
                    <div className="w-full rounded-[14px] bg-white/[0.055] px-4 py-3 text-center text-sm text-white/65 ring-1 ring-white/10">
                      Veuillez créer un compte pour pouvoir utiliser le dock
                    </div>
                  ) : favoriteDockApps.length > 0 ? (
                    <DockFavoritesBar
                      apps={favoriteDockApps}
                      editMode={dockEditMode}
                      logoUrl={logoUrl}
                      onEnterEditMode={() => {
                        setDockDraftIds([...favoriteOrder]);
                        setDockEditMode(true);
                      }}
                      onRemoveFavorite={handleRemoveFavoriteFromDock}
                      onReorder={handleReorderDockFavorites}
                    />
                  ) : (
                    <div className="rounded-[14px] bg-white/[0.055] px-4 py-3 text-sm text-white/60 ring-1 ring-white/10">
                      {normalizedQuery
                        ? 'Aucun favori ne correspond à cette recherche.'
                        : 'Ajoutez des favoris : appui long (~1,2 s) sur une app dans les menus latéraux, puis confirmez.'}
                    </div>
                  )}
                </div>
                </div>
            </motion.div>
          </div>
        </div>

        {/* 1) Purpose: copyright fixé au bas du viewport, hors du cadre arrondi principal.
            2) Key variables: année courante ; z au-dessus du dock pour rester lisible.
            3) Logic flow: `fixed` + `pointer-events-none` pour ne pas bloquer les clics. */}
        <p className="pointer-events-none fixed bottom-2 left-0 right-0 z-[60] text-center text-[10px] leading-relaxed tracking-wide text-white/45 md:bottom-3">
          © {new Date().getFullYear()} NaviSphere
        </p>
      </main>

      {/* 1) Purpose:
          - Afficher les encarts modaux Connexion et Inscription par-dessus l'interface.
          2) Key variables:
          - `authModal`: détermine quel formulaire est rendu (`login` ou `register`).
          - Fond : voile très léger (`bg-black/15`) + flou encore plus discret (`backdrop-blur-[4px]`) sur le reste de l'écran.
          - Clic sur le fond : `closeAuthModal`; clic sur la carte : propagation stoppée.
          3) Logic flow:
          - `AnimatePresence` gère l'entrée/sortie; le contenu bascule selon `authModal` avec une animation courte. */}
      <AnimatePresence>
        {authModal && (
          <motion.div
            key="auth-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/15 p-4 backdrop-blur-[4px]"
            onClick={closeAuthModal}
          >
            <motion.div
              key={authModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby={authModal === 'login' ? 'auth-login-title' : 'auth-register-title'}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative w-full max-w-md rounded-[20px] bg-[#11151b]/95 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeAuthModal}
                className="absolute right-4 top-4 rounded-full bg-white/8 p-2 text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.14]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>

              {authModal === 'login' ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Compte</p>
                  <h2 id="auth-login-title" className="mt-1 text-lg font-medium text-white">
                    Connexion
                  </h2>
                  {/* 1) Purpose:
                      - Collecter e-mail + mot de passe pour la connexion Firebase.
                      2) Key variables:
                      - Champs contrôlés `loginEmail`, `loginPassword`.
                      3) Logic flow:
                      - Soumission → `handleLoginSubmit`. */}
                  <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                    {authFormError && (
                      <p className="rounded-[10px] bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-400/25">
                        {authFormError}
                      </p>
                    )}
                    <div>
                      <label
                        htmlFor="login-email"
                        className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/45"
                      >
                        E-mail
                      </label>
                      <input
                        id="login-email"
                        name="email"
                        type="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        autoComplete="username"
                        className="w-full rounded-[12px] bg-black/35 px-3 py-3 text-sm text-white ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
                        placeholder="vous@exemple.com"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="login-password"
                        className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/45"
                      >
                        Mot de passe
                      </label>
                      <input
                        id="login-password"
                        name="password"
                        type="password"
                        value={loginPassword}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        autoComplete="current-password"
                        className="w-full rounded-[12px] bg-black/35 px-3 py-3 text-sm text-white ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
                        placeholder="••••••••"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-[12px] bg-white/[0.12] px-3 py-3 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/[0.18]"
                    >
                      Connexion
                    </button>
                    <p className="text-xs leading-relaxed text-white/55">
                      Mot de passe oublié : une réinitialisation par e-mail pourra être ajoutée dans l’app (Firebase Auth).
                    </p>
                  </form>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Compte</p>
                  <h2 id="auth-register-title" className="mt-1 text-lg font-medium text-white">
                    Inscription
                  </h2>
                  {/* 1) Purpose:
                      - Créer un compte Firebase (e-mail, mot de passe et confirmation).
                      2) Key variables:
                      - `registerPasswordMismatch`: affiche une alerte si les mots de passe divergent.
                      3) Logic flow:
                      - Soumission → `handleRegisterSubmit` vérifie la paire de mots de passe puis ferme si OK. */}
                  <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
                    {authFormError && (
                      <p className="rounded-[10px] bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-400/25">
                        {authFormError}
                      </p>
                    )}
                    <div>
                      <label
                        htmlFor="register-email"
                        className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/45"
                      >
                        E-mail
                      </label>
                      <input
                        id="register-email"
                        name="email"
                        type="email"
                        value={registerEmail}
                        onChange={(event) => setRegisterEmail(event.target.value)}
                        autoComplete="username"
                        className="w-full rounded-[12px] bg-black/35 px-3 py-3 text-sm text-white ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
                        placeholder="vous@exemple.com"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="register-password"
                        className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/45"
                      >
                        Mot de passe
                      </label>
                      <input
                        id="register-password"
                        name="password"
                        type="password"
                        value={registerPassword}
                        onChange={(event) => {
                          setRegisterPassword(event.target.value);
                          setRegisterPasswordMismatch(false);
                        }}
                        autoComplete="new-password"
                        className="w-full rounded-[12px] bg-black/35 px-3 py-3 text-sm text-white ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="register-password-confirm"
                        className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/45"
                      >
                        Confirmez le mot de passe
                      </label>
                      <input
                        id="register-password-confirm"
                        name="password-confirm"
                        type="password"
                        value={registerPasswordConfirm}
                        onChange={(event) => {
                          setRegisterPasswordConfirm(event.target.value);
                          setRegisterPasswordMismatch(false);
                        }}
                        autoComplete="new-password"
                        className="w-full rounded-[12px] bg-black/35 px-3 py-3 text-sm text-white ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
                        placeholder="Répétez le mot de passe"
                      />
                    </div>
                    {registerPasswordMismatch && (
                      <p className="text-xs font-medium text-rose-300/95">
                        Les mots de passe ne correspondent pas.
                      </p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-[12px] bg-white/[0.12] px-3 py-3 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/[0.18]"
                    >
                      Confirmer
                    </button>
                    <p className="text-xs leading-relaxed text-white/55">
                      L’e-mail sert à votre compte et à la récupération du mot de passe ; les favoris sont stockés dans
                      Firestore, accessibles uniquement avec votre session.
                    </p>
                  </form>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1) Purpose:
          - Confirmer l'ajout d'un service aux favoris après appui long dans les grilles latérales.
          2) Key variables:
          - `favoritePendingServiceId`: id service ; libellé via `ALL_CATALOG_BY_ID`.
          3) Logic flow:
          - `AnimatePresence` pour l'entrée/sortie; z-index au-dessus du reste sauf si besoin d'empiler avec l'auth. */}
      <AnimatePresence>
        {favoritePendingServiceId && (
          <FavoriteConfirmModal
            key="fav-pending"
            appName={
              ALL_CATALOG_BY_ID.get(favoritePendingServiceId)?.name ?? favoritePendingServiceId
            }
            onConfirm={() => void confirmFavoriteAdd()}
            onCancel={() => setFavoritePendingServiceId(null)}
          />
        )}
      </AnimatePresence>

      {/* 1) Purpose:
          - Catalogue des mini-jeux NaviSphere ; fond de scène visible (pas de voile assombrissant).
          2) Key variables: `navisphereGames` ; z-index sous le panneau de jeu.
          3) Logic flow: fermeture clic hors carte / X ; « Jouer » ferme ce panneau et définit `openGameId`. */}
      <AnimatePresence>
        {navisphereGamesModalOpen && (
          <motion.div
            key="navisphere-games-picker"
            className="fixed inset-0 z-[106] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              role="presentation"
              className="absolute inset-0"
              onClick={() => setNavisphereGamesModalOpen(false)}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="navisphere-games-modal-title"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-[1] w-full max-w-md rounded-[18px] bg-black/30 p-5 shadow-[0_12px_48px_rgba(0,0,0,0.35)] ring-1 ring-white/15"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setNavisphereGamesModalOpen(false)}
                className="absolute right-3 top-3 rounded-full bg-white/8 p-2 text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.14]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">NaviSphere</p>
              <h3 id="navisphere-games-modal-title" className="mt-1 pr-8 text-lg font-medium text-white">
                Jeux intégrés
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                En solo ou à plusieurs, affrontez votre Tesla : venez jouer à nos classiques intégrés.
              </p>
              {navisphereGames.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {navisphereGames.map((game) => (
                    <li
                      key={game.id}
                      className="flex flex-col gap-2 rounded-[14px] bg-white/[0.055] p-3 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{game.title}</p>
                        <p className="mt-0.5 text-xs text-white/45">{game.blurb}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenGameId(game.id);
                          setNavisphereGamesModalOpen(false);
                        }}
                        className="shrink-0 rounded-[12px] bg-white/[0.12] px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/[0.18]"
                      >
                        Jouer
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-[12px] bg-black/25 px-3 py-3 text-sm text-white/55 ring-1 ring-white/10">
                  Aucun jeu disponible pour le moment.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1) Purpose:
          - Panneau d’aide contextuel (raccourcis favoris / dock / session).
          2) Key variables:
          - `helpModalOpen`: contrôle l’affichage depuis le bouton icône Aide.
          3) Logic flow:
          - Fond cliquable ou bouton Fermer pour `setHelpModalOpen(false)`. */}
      <AnimatePresence>
        {helpModalOpen && (
          <motion.div
            key="help-modal"
            className="fixed inset-0 z-[105] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              role="presentation"
              className="absolute inset-0 bg-black/15 backdrop-blur-[4px]"
              onClick={() => setHelpModalOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-modal-title"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-[1] w-full max-w-md rounded-[18px] bg-[#11151b]/95 p-5 shadow-[0_32px_100px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setHelpModalOpen(false)}
                className="absolute right-3 top-3 rounded-full bg-white/8 p-2 text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.14]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Aide</p>
              <h3 id="help-modal-title" className="mt-1 pr-8 text-lg font-medium text-white">
                NaviSphere
              </h3>
              <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed text-white/70">
                <li>
                  Appui long (~1,2 s) sur une app dans les menus latéraux pour proposer l’ajout aux favoris.
                </li>
                <li>
                  Le dock affiche vos favoris. Appui long sur une tuile du dock pour le mode édition
                  (réorganisation, suppression en local). Appuyez sur « Terminé » pour enregistrer une seule fois
                  dans la feuille (colonnes des apps).
                </li>
                <li>La déconnexion efface la session sur cet appareil (alias stocké localement).</li>
              </ul>
              <button
                type="button"
                onClick={() => setHelpModalOpen(false)}
                className="mt-6 w-full rounded-[12px] bg-white/[0.12] px-3 py-2.5 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/[0.18]"
              >
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!openGameId && <ViewportDebugOverlay />}
    </div>
  );
}
