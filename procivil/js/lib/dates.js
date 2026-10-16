// Manipulation de dates civiles au format ISO « AAAA-MM-JJ ».
// Tout est calculé en UTC pour éviter les décalages dus à l'heure d'été :
// une date de procédure est un jour civil, pas un instant.

const MS_JOUR = 86400000;

export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) throw new Error(`Date invalide : « ${iso} » (format attendu AAAA-MM-JJ)`);
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) {
    throw new Error(`Date inexistante : « ${iso} »`);
  }
  return d;
}

export function estDateISO(iso) {
  try { parseISO(iso); return true; } catch { return false; }
}

export function toISO(d) {
  return d.toISOString().slice(0, 10);
}

export function fromYMD(a, m, j) {
  return toISO(new Date(Date.UTC(a, m - 1, j)));
}

export function ajouterJours(iso, n) {
  return toISO(new Date(parseISO(iso).getTime() + n * MS_JOUR));
}

export function dernierJourDuMois(a, m) {
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function estBissextile(a) {
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
}

// Art. 641 al. 2 CPC : le délai exprimé en mois expire le jour du dernier mois
// qui porte le même quantième que le jour de départ ; à défaut d'un quantième
// identique, le dernier jour du mois.
export function ajouterMois(iso, n) {
  const d = parseISO(iso);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const j = Math.min(d.getUTCDate(), dernierJourDuMois(a, m));
  return fromYMD(a, m, j);
}

// 0 = dimanche … 6 = samedi
export function jourSemaine(iso) {
  return parseISO(iso).getUTCDay();
}

export function ecartJours(isoDe, isoA) {
  return Math.round((parseISO(isoA) - parseISO(isoDe)) / MS_JOUR);
}

export function comparer(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function aujourdhuiISO(maintenant = new Date()) {
  // Jour civil local de l'utilisateur (et non UTC) : c'est la date de son bureau.
  const a = maintenant.getFullYear();
  const m = String(maintenant.getMonth() + 1).padStart(2, '0');
  const j = String(maintenant.getDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

export function nomJour(iso) {
  return JOURS[jourSemaine(iso)];
}

export function formatLong(iso) {
  const d = parseISO(iso);
  const j = d.getUTCDate();
  return `${JOURS[d.getUTCDay()]} ${j === 1 ? '1er' : j} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatCourt(iso) {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

// Convertit « 12/03/2025 », « 12.03.25 » ou « 12 mars 2025 » en ISO ; null si échec.
export function depuisTexteFR(txt) {
  if (!txt) return null;
  const t = txt.trim().toLowerCase().replace(/\s+/g, ' ');
  let m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(t);
  if (m) {
    let a = Number(m[3]);
    if (a < 100) a += 2000;
    const iso = fromYMD(a, Number(m[2]), Number(m[1]));
    return estDateISO(iso) && Number(iso.slice(8)) === Number(m[1]) ? iso : null;
  }
  m = /^(\d{1,2})(?:er)? ([a-zéû]+) (\d{4})$/.exec(t);
  if (m) {
    const idx = MOIS.findIndex((x) => x === m[2] || x.normalize('NFD').replace(/[̀-ͯ]/g, '') === m[2].normalize('NFD').replace(/[̀-ͯ]/g, ''));
    if (idx < 0) return null;
    const iso = fromYMD(Number(m[3]), idx + 1, Number(m[1]));
    return Number(iso.slice(8)) === Number(m[1]) ? iso : null;
  }
  return null;
}

export const NOMS_MOIS = MOIS;
