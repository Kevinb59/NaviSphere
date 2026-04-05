// 1) Purpose:
// - Centraliser `Math.random` hors du corps du composant React pour satisfaire la règle de pureté du rendu (ESLint).
// 2) Key variables: tableaux d’état visuel figés au premier montage via `useState(() => build…())`.
// 3) Logic flow: fonctions invoquées une seule fois par instance de page, pas pendant chaque re-render.

export type StarFieldNode = {
  id: string;
  left: number;
  top: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
};

// 1) Purpose:
// - Produire la liste des étoiles de fond (positions et paramètres d’animation CSS).
// 2) Key variables: `count` = nombre de nœuds (ex. 110) ; `size` / `opacity` relevés pour écrans auto (contraste).
// 3) Logic flow: une passe `Array.from` + tirages aléatoires indépendants par étoile.
export function buildStarFieldNodes(count: number): StarFieldNode[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `star-${index}`,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1 + Math.random() * 2.85,
    opacity: 0.52 + Math.random() * 0.48,
    duration: 2.4 + Math.random() * 5.2,
    delay: Math.random() * 6,
  }));
}

export type WarpParticleConfig = {
  id: string;
  left: number;
  top: number;
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  size: number;
};

// 1) Purpose:
// - Générer les particules « warp » (trajectoires radiales depuis le centre).
// 2) Key variables: `count` = nombre de trajectoires (ex. 12) ; `size` un peu plus grand pour mieux les distinguer.
// 3) Logic flow: même principe que les étoiles, avec plages adaptées au mouvement de fuite.
export function buildWarpParticles(count: number): WarpParticleConfig[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `warp-${index}`,
    left: 49.5 + (Math.random() * 3 - 1.5),
    top: 49.5 + (Math.random() * 3 - 1.5),
    angle: Math.random() * 360,
    distance: 1040 + Math.random() * 840,
    duration: 2.6 + Math.random() * 2.4,
    delay: Math.random() * 4.5,
    size: 1.25 + Math.random() * 1.55,
  }));
}
