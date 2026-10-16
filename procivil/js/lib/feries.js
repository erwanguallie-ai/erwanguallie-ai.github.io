// Jours fériés : calcul de Pâques et des fêtes mobiles, zones locales.
// Les listes de jours fériés sont dans data/feries.json.
import { fromYMD, ajouterJours, jourSemaine, parseISO } from './dates.js';

// Dimanche de Pâques (calendrier grégorien), algorithme de Meeus/Jones/Butcher.
export function paques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return fromYMD(annee, mois, jour);
}

function dateDe(regle, annee) {
  if (regle.type === 'fixe') return fromYMD(annee, regle.mois, regle.jour);
  if (regle.type === 'paques') return ajouterJours(paques(annee), regle.decalage);
  throw new Error(`Type de jour férié inconnu : ${regle.type}`);
}

const cache = new Map();

// Retourne une Map iso -> libellé pour une année et une zone.
export function feriesAnnee(annee, zone, donnees) {
  const cle = `${annee}|${zone}`;
  if (cache.has(cle) && cache.get(cle).donnees === donnees) return cache.get(cle).map;
  const map = new Map();
  for (const r of donnees.nationaux) map.set(dateDe(r, annee), r.libelle);
  const z = donnees.zones[zone];
  if (zone && !z) throw new Error(`Zone de jours fériés inconnue : ${zone}`);
  for (const r of (z?.supplementaires || [])) map.set(dateDe(r, annee), r.libelle);
  cache.set(cle, { donnees, map });
  return map;
}

// Zone de jours fériés à partir d'un code département (« 57 », « 974 »…).
export function zoneDepuisDepartement(dep, donnees) {
  if (!dep) return 'metropole';
  for (const [id, z] of Object.entries(donnees.zones)) {
    if (z.departements.includes(String(dep))) return id;
  }
  return 'metropole';
}

// Motif pour lequel le jour n'est pas ouvrable (null s'il l'est).
// joursChomes : liste d'objets { date, libelle } saisis par l'avocat.
export function motifNonOuvrable(iso, zone, donnees, joursChomes = []) {
  const js = jourSemaine(iso);
  if (js === 6) return 'samedi';
  if (js === 0) return 'dimanche';
  const ferie = feriesAnnee(parseISO(iso).getUTCFullYear(), zone || 'metropole', donnees).get(iso);
  if (ferie) return `jour férié (${ferie})`;
  const chome = joursChomes.find((c) => c.date === iso);
  if (chome) return `jour chômé (${chome.libelle || 'saisi dans les paramètres'})`;
  return null;
}

export function listeFeries(annee, zone, donnees) {
  return [...feriesAnnee(annee, zone, donnees).entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}
