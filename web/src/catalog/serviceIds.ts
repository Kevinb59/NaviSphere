// 1) Purpose:
// - Produire des identifiants stables (slugs) pour les colonnes C–Z du Sheet : pas d’espaces ni de « + » littéral.
// 2) Key variables: `withUniqueIds` garantit l’unicité sur tout le catalogue fusionné.
// 3) Logic flow: slug ASCII à partir du nom → suffixe numérique si collision.

export type WithServiceId<T extends { name: string }> = T & { id: string };

// 1) Purpose:
// - Convertir un libellé affiché en identifiant stockable (cellules Sheet, JSON).
// 2) Key variables: `name` = texte UI (accents, espaces, ponctuation).
// 3) Logic flow: NFD sans accents → minuscules → caractères non alphanum → tirets → trim des tirets.
export function serviceIdFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 1) Purpose:
// - Attacher un champ `id` unique à chaque entrée du catalogue fusionné.
// 2) Key variables: `used` = ensemble des ids déjà attribués dans ce batch.
// 3) Logic flow: slug de base ; si déjà pris, essayer `-1`, `-2`, …
export function withUniqueIds<T extends { name: string }>(items: T[]): WithServiceId<T>[] {
  const used = new Set<string>();
  return items.map((item) => {
    const base = serviceIdFromName(item.name);
    let id = base;
    let n = 0;
    while (used.has(id)) {
      n += 1;
      id = `${base}-${n}`;
    }
    used.add(id);
    return { ...item, id };
  });
}

// 1) Purpose:
// - Recréer les tranches (dock, musique, …) après fusion + attribution d’ids.
// 2) Key variables: `lengths` = taille de chaque bloc dans l’ordre de concaténation.
// 3) Logic flow: découpe séquentielle du tableau aplati avec ids.
export function splitCatalogByBlockLengths<T>(flatWithIds: T[], lengths: number[]): T[][] {
  const blocks: T[][] = [];
  let offset = 0;
  for (const len of lengths) {
    blocks.push(flatWithIds.slice(offset, offset + len));
    offset += len;
  }
  return blocks;
}
