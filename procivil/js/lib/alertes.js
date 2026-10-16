// Niveaux d'urgence, libellés, tri des affaires par priorité, seuils.
import { ecartJours, comparer } from './dates.js';

export const SEUILS_DEFAUT = Object.freeze({ rouge: 3, orange: 7 });
export const SEUIL_MAX = 365;

export function validerSeuils(rouge, orange) {
  const erreurs = [];
  const r = Number(rouge);
  const o = Number(orange);
  if (rouge === '' || rouge === null || rouge === undefined || !Number.isInteger(r) || r < 0) {
    erreurs.push('Le seuil rouge doit être un nombre entier de jours, égal ou supérieur à 0.');
  }
  if (orange === '' || orange === null || orange === undefined || !Number.isInteger(o) || o < 1) {
    erreurs.push('Le seuil orange doit être un nombre entier de jours, égal ou supérieur à 1.');
  }
  if (Number.isInteger(o) && o > SEUIL_MAX) erreurs.push(`Le seuil orange ne peut pas dépasser ${SEUIL_MAX} jours.`);
  if (!erreurs.length && o <= r) {
    erreurs.push(`Le seuil orange (${o} j) doit être strictement supérieur au seuil rouge (${r} j).`);
  }
  return { ok: erreurs.length === 0, erreurs, valeurs: erreurs.length ? null : { rouge: r, orange: o } };
}

export function joursRestants(echeance, aujourdhui) {
  return ecartJours(aujourdhui, echeance);
}

// 'expire' | 'rouge' | 'orange' | 'normal' | 'aucun'
export function niveau(jours, seuils = SEUILS_DEFAUT) {
  if (jours === null || jours === undefined) return 'aucun';
  if (jours < 0) return 'expire';
  if (jours <= seuils.rouge) return 'rouge';
  if (jours <= seuils.orange) return 'orange';
  return 'normal';
}

export const NIVEAUX = {
  expire: { icone: '⛔', titre: 'Délai expiré' },
  rouge: { icone: '⚠️', titre: 'Urgent' },
  orange: { icone: '⏳', titre: 'À surveiller' },
  normal: { icone: '📅', titre: 'Dans les temps' },
  aucun: { icone: '—', titre: 'Aucun délai en cours' },
  accompli: { icone: '✔', titre: 'Accompli' },
};

export function libelleEcheance(jours) {
  if (jours === null || jours === undefined) return 'Aucun délai en cours';
  if (jours < -1) return `Expiré depuis ${-jours} jours`;
  if (jours === -1) return 'Expiré depuis hier';
  if (jours === 0) return "Expire aujourd'hui à 24 h";
  if (jours === 1) return 'Expire demain à 24 h';
  return `Expire dans ${jours} jours`;
}

export function seuilsAffaire(affaire, globaux) {
  const s = affaire?.seuils;
  if (s && validerSeuils(s.rouge, s.orange).ok) return { rouge: Number(s.rouge), orange: Number(s.orange) };
  return globaux;
}

// Délai à afficher pour l'affaire : le plus ancien délai non accompli
// (un délai expiré non traité reste prioritaire sur un délai à venir).
export function delaiPrioritaire(affaire, aujourdhui) {
  const ouverts = (affaire.delais || [])
    .filter((d) => d.statut !== 'accompli' && d.echeance)
    .sort((a, b) => comparer(a.echeance, b.echeance));
  if (!ouverts.length) return null;
  const d = ouverts[0];
  const suivant = ouverts.find((x) => joursRestants(x.echeance, aujourdhui) >= 0 && x !== d) || null;
  return { delai: d, jours: joursRestants(d.echeance, aujourdhui), suivant, nbOuverts: ouverts.length };
}

// Tri par priorité : échéance la plus proche en tête (les délais expirés,
// antérieurs à aujourd'hui, arrivent donc en premier), puis les affaires
// sans délai en cours, par ordre alphabétique.
export function trierAffaires(affaires, aujourdhui) {
  return affaires
    .map((a) => ({ affaire: a, prio: delaiPrioritaire(a, aujourdhui) }))
    .sort((x, y) => {
      if (x.prio && !y.prio) return -1;
      if (!x.prio && y.prio) return 1;
      if (x.prio && y.prio) {
        const c = comparer(x.prio.delai.echeance, y.prio.delai.echeance);
        if (c) return c;
      }
      return (x.affaire.nom || '').localeCompare(y.affaire.nom || '', 'fr');
    });
}
