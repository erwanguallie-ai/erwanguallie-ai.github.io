// Persistance : localStorage du navigateur + export / import JSON.
// Les données restent sur ce navigateur ; rien n'est envoyé à un serveur.
import { SEUILS_DEFAUT } from './lib/alertes.js';
import * as cr from './crypto.js';

const CLE = 'procivil.v1';
export const VERSION_FORMAT = 1;

export function etatVide() {
  return {
    format: 'procivil',
    version: VERSION_FORMAT,
    parametres: {
      seuils: { ...SEUILS_DEFAUT },
      joursChomes: [],
      chiffrement: false,
      ia: { active: false, urlProxy: '', jeton: '' },
      derniereSauvegarde: null,
      demoChargee: false,
    },
    affaires: [],
  };
}

let session = null; // clé de chiffrement en mémoire (jamais persistée)

export function estChiffre() {
  try {
    const brut = localStorage.getItem(CLE);
    return !!brut && JSON.parse(brut).format === 'procivil-chiffre';
  } catch { return false; }
}

export function stockageDisponible() {
  try {
    const t = '__procivil_test__';
    localStorage.setItem(t, '1'); localStorage.removeItem(t);
    return true;
  } catch { return false; }
}

// Complète un état lu (ancienne version, import partiel) avec les valeurs par défaut.
export function normaliser(etat) {
  const vide = etatVide();
  if (!etat || etat.format !== 'procivil') throw new Error("Ce fichier n'est pas une sauvegarde de l'outil (champ « format » absent ou incorrect).");
  if (!Array.isArray(etat.affaires)) throw new Error('Sauvegarde invalide : liste des affaires absente.');
  const p = { ...vide.parametres, ...(etat.parametres || {}) };
  p.seuils = { ...vide.parametres.seuils, ...(p.seuils || {}) };
  p.ia = { ...vide.parametres.ia, ...(p.ia || {}) };
  if (!Array.isArray(p.joursChomes)) p.joursChomes = [];
  const affaires = etat.affaires.map((a) => ({
    actes: [], delais: [], parties: {}, contexte: {}, statut: 'en_cours', ...a,
  }));
  return { ...vide, ...etat, version: VERSION_FORMAT, parametres: p, affaires };
}

export async function charger(phrase) {
  const brut = localStorage.getItem(CLE);
  if (!brut) return null;
  const obj = JSON.parse(brut);
  if (obj.format === 'procivil-chiffre') {
    if (!phrase) throw new Error('PHRASE_REQUISE');
    const { objet, session: s } = await cr.dechiffrer(obj, phrase);
    session = s;
    return normaliser(objet);
  }
  return normaliser(obj);
}

export async function enregistrer(etat) {
  let contenu;
  if (etat.parametres.chiffrement) {
    if (!session) throw new Error('Chiffrement activé mais aucune phrase secrète en mémoire.');
    contenu = JSON.stringify(await cr.chiffrer(etat, session));
  } else {
    contenu = JSON.stringify(etat);
  }
  try {
    localStorage.setItem(CLE, contenu);
  } catch (e) {
    throw new Error(`Enregistrement impossible (stockage plein ou bloqué) : ${e.message}`);
  }
}

export async function activerChiffrement(etat, phrase) {
  if (!cr.disponible()) throw new Error("Le chiffrement n'est pas disponible dans ce navigateur (contexte non sécurisé ?).");
  session = await cr.nouvelleCle(phrase);
  etat.parametres.chiffrement = true;
  await enregistrer(etat);
}

export async function desactiverChiffrement(etat) {
  etat.parametres.chiffrement = false;
  session = null;
  await enregistrer(etat);
}

export function effacerTout() {
  localStorage.removeItem(CLE);
  session = null;
}

export async function exporter(etat, { chiffre = false } = {}) {
  const copie = { ...etat, exporteLe: new Date().toISOString() };
  const contenu = chiffre && session ? await cr.chiffrer(copie, session) : copie;
  return new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
}

export async function lireFichier(texte, phrase) {
  const obj = JSON.parse(texte);
  if (obj.format === 'procivil-chiffre') {
    if (!phrase) throw new Error('PHRASE_REQUISE');
    return normaliser((await cr.dechiffrer(obj, phrase)).objet);
  }
  return normaliser(obj);
}

// Fusion : les affaires importées remplacent celles de même identifiant.
export function fusionner(etat, importe) {
  const parId = new Map(etat.affaires.map((a) => [a.id, a]));
  for (const a of importe.affaires) parId.set(a.id, a);
  return { ...etat, affaires: [...parId.values()] };
}

export function nouvelId(prefixe = 'id') {
  const alea = globalThis.crypto?.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefixe}_${Date.now().toString(36)}${alea}`;
}
