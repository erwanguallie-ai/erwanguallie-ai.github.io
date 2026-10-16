// Opérations sur les affaires, leurs actes et leurs délais.
import { recalculerDelaiAffaire, trouverType } from './lib/delais.js';
import { ajouterJours, comparer } from './lib/dates.js';
import { joursRestants, niveau } from './lib/alertes.js';
import { nouvelId } from './storage.js';

export function creerAffaire(donnees) {
  const maintenant = new Date().toISOString();
  return {
    id: nouvelId('aff'),
    nom: donnees.nom?.trim() || 'Affaire sans titre',
    reference: donnees.reference || '',
    rg: donnees.rg || '',
    parties: { demandeur: donnees.demandeur || '', defendeur: donnees.defendeur || '' },
    client: donnees.client || 'demandeur',
    juridiction: donnees.juridiction || { libelle: donnees.juridictionLibelle || '' },
    contexte: {
      lieuJuridiction: donnees.lieuJuridiction || 'metropole',
      zoneFeries: donnees.zoneFeries || 'metropole',
      residence: donnees.residence || 'metropole',
    },
    statut: 'en_cours',
    seuils: null,
    notes: donnees.notes || '',
    actes: [],
    delais: [],
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

const toucher = (a) => { a.modifieLe = new Date().toISOString(); };

export function ajouterActe(affaire, { type, libelle, date, commentaire = '', source = 'manuel', document = null }) {
  const acte = { id: nouvelId('acte'), type, libelle, date, commentaire, source, document };
  affaire.actes.push(acte);
  affaire.actes.sort((x, y) => comparer(x.date, y.date));
  toucher(affaire);
  return acte;
}

export function ajouterDelai(affaire, options, regles, joursChomes) {
  const type = trouverType(regles.catalogue, options.typeId);
  const delai = {
    id: nouvelId('del'),
    typeId: type.id,
    libelle: options.libelle || type.libelle,
    article: type.article,
    acteId: options.acteId || null,
    dateDepart: options.dateDepart || null,
    residence: options.residence || null,
    notifieSurPlace: !!options.notifieSurPlace,
    interruption: options.interruption || null,
    duree: options.duree || null,
    sens: options.sens || null,
    prorogation: options.prorogation,
    dateImposee: options.dateImposee || null,
    statut: options.statut || 'a_faire',
    accompliLe: options.accompliLe || null,
    note: options.note || '',
  };
  const calcule = recalculerDelaiAffaire(delai, affaire, regles, joursChomes);
  affaire.delais.push(calcule);
  toucher(affaire);
  return calcule;
}

export function recalculerAffaire(affaire, regles, joursChomes) {
  const erreurs = [];
  affaire.delais = affaire.delais.map((d) => {
    try { return recalculerDelaiAffaire(d, affaire, regles, joursChomes); } catch (e) {
      erreurs.push(`${d.libelle} : ${e.message}`);
      return d;
    }
  });
  return erreurs;
}

// Modifie un acte et recalcule les délais qui en découlent.
export function modifierActe(affaire, idActe, champs, regles, joursChomes) {
  const acte = affaire.actes.find((a) => a.id === idActe);
  if (!acte) throw new Error('Acte introuvable.');
  Object.assign(acte, champs);
  affaire.actes.sort((x, y) => comparer(x.date, y.date));
  const impactes = affaire.delais.filter((d) => d.acteId === idActe);
  const avant = new Map(impactes.map((d) => [d.id, d.echeance]));
  recalculerAffaire(affaire, regles, joursChomes);
  toucher(affaire);
  return affaire.delais.filter((d) => avant.has(d.id)).map((d) => ({ libelle: d.libelle, avant: avant.get(d.id), apres: d.echeance }));
}

export function supprimerActe(affaire, idActe) {
  affaire.actes = affaire.actes.filter((a) => a.id !== idActe);
  const supprimes = affaire.delais.filter((d) => d.acteId === idActe);
  affaire.delais = affaire.delais.filter((d) => d.acteId !== idActe);
  toucher(affaire);
  return supprimes;
}

export function basculerAccompli(affaire, idDelai, aujourdhui) {
  const d = affaire.delais.find((x) => x.id === idDelai);
  d.statut = d.statut === 'accompli' ? 'a_faire' : 'accompli';
  d.accompliLe = d.statut === 'accompli' ? aujourdhui : null;
  toucher(affaire);
  return d;
}

// Éléments de la frise : actes et échéances, triés, avec le repère « aujourd'hui ».
export function evenementsFrise(affaire, aujourdhui, seuils) {
  const items = [];
  for (const a of affaire.actes) items.push({ genre: 'acte', date: a.date, acte: a, passe: comparer(a.date, aujourdhui) < 0 });
  for (const d of affaire.delais) {
    const j = joursRestants(d.echeance, aujourdhui);
    items.push({ genre: 'delai', date: d.echeance, delai: d, jours: j, niveau: d.statut === 'accompli' ? 'accompli' : niveau(j, seuils) });
  }
  items.sort((x, y) => comparer(x.date, y.date) || (x.genre === 'acte' ? -1 : 1));
  const i = items.findIndex((x) => comparer(x.date, aujourdhui) > 0 || (x.date === aujourdhui && x.genre === 'delai'));
  items.splice(i < 0 ? items.length : i, 0, { genre: 'aujourdhui', date: aujourdhui });
  return items;
}

// --- Affaires de démonstration ---
// Les dates sont recalculées par rapport au jour courant pour que la
// démonstration montre toujours une affaire urgente, une à surveiller,
// une expirée et une dans les temps.
const CIBLES = { rouge: [0, 3], orange: [4, 7], expire: [-6, -1], normal: [20, 90] };

export function genererDemo(modele, regles, aujourdhui) {
  return modele.affaires.map((m) => {
    const a = creerAffaire(m);
    a.id = m.id;
    a.juridiction = m.juridiction;
    a.notes = m.notes || '';
    a.demo = true;
    const cible = m.cible;
    const actesCibles = new Set((m.delais || []).filter((d) => d.cible).map((d) => d.acte));

    // Position de l'acte qui déclenche le délai visé : on cherche la date de
    // départ qui place l'échéance dans la fourchette de niveau voulue.
    let decalageCible = 0;
    const delaiCible = (m.delais || []).find((d) => d.cible);
    if (delaiCible) {
      const [min, max] = CIBLES[cible];
      const essai = { ...a, actes: [] };
      // Seuils de démonstration : par défaut (3 / 7) ; on vise le milieu de la fourchette.
      const milieu = (min + max) / 2;
      let ecartMin = Infinity;
      for (let o = 0; o > -800; o -= 1) {
        const date = ajouterJours(aujourdhui, o);
        essai.actes = [{ id: 'x', date }];
        const r = recalculerDelaiAffaire({ ...delaiCible, acteId: 'x' }, essai, regles, []);
        const j = joursRestants(r.echeance, aujourdhui);
        const ecart = j >= min && j <= max ? Math.abs(j - milieu) / 100 : Math.min(Math.abs(j - min), Math.abs(j - max));
        if (ecart < ecartMin) { ecartMin = ecart; decalageCible = o; }
        if (j < min - 400) break;
      }
    }
    const ids = [];
    m.actes.forEach((x, i) => {
      const base = actesCibles.has(i) ? decalageCible : decalageCible + (x.decalage || 0);
      const acte = ajouterActe(a, { type: x.type, libelle: x.libelle, date: ajouterJours(aujourdhui, actesCibles.has(i) ? decalageCible : base), commentaire: x.commentaire || '' });
      ids[i] = acte.id;
    });
    for (const d of m.delais || []) {
      const opts = { ...d, acteId: ids[d.acte] };
      const del = ajouterDelai(a, opts, regles, []);
      if (d.statut === 'accompli') { del.statut = 'accompli'; del.accompliLe = ajouterJours(del.echeance, -3); }
    }
    return a;
  });
}
