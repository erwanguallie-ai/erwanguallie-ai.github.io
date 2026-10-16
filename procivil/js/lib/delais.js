// Calcul des délais de procédure : art. 640 à 642 CPC (décompte),
// art. 643, 644 et 647 CPC (délais de distance). Les règles propres à chaque
// délai (durée, article, sanction, distance) viennent de data/delais.json.
import {
  ajouterJours, ajouterMois, formatLong, parseISO, comparer, estDateISO,
} from './dates.js';
import { motifNonOuvrable } from './feries.js';

export function trouverType(catalogue, id) {
  const t = catalogue.delais.find((d) => d.id === id);
  if (!t) throw new Error(`Type de délai inconnu : ${id}`);
  return t;
}

export function libelleDuree(duree) {
  if (!duree) return '—';
  const p = [];
  if (duree.ans) p.push(`${duree.ans} an${duree.ans > 1 ? 's' : ''}`);
  if (duree.mois) p.push(`${duree.mois} mois`);
  if (duree.jours) p.push(`${duree.jours} jour${duree.jours > 1 ? 's' : ''}`);
  return p.join(' et ') || '0 jour';
}

function minusculeInitiale(t) {
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : '';
}

function estOutremer(id, distance) {
  return !!distance.residences.find((r) => r.id === id)?.outremer;
}

// Augmentation en mois due à l'éloignement de la partie. Retourne
// { mois, texte, article, verifie } ou null si aucune augmentation.
export function augmentationDistance(type, { residence = 'metropole', lieuJuridiction = 'metropole', notifieSurPlace = false }, distance) {
  if (!type.distance) return null;
  if (residence === 'metropole' && lieuJuridiction === 'metropole') return null;
  if (notifieSurPlace) {
    return { mois: 0, article: 'art. 647 CPC', texte: "Notification faite à la personne dans un lieu où elle ne bénéficierait pas de l'augmentation : seuls les délais applicables en ce lieu sont ouverts (art. 647 CPC)." };
  }
  if (typeof type.distance === 'object') {
    const d = type.distance;
    const base = d.base || 'juridiction';
    let cat = null;
    if (residence === 'etranger') cat = 'etranger';
    else if (base === 'metropole' ? residence !== 'metropole' : residence !== lieuJuridiction) cat = 'outremer';
    if (!cat || !d[cat]) return null;
    return { mois: d[cat], article: d.article, verifie: d.verifie !== false, texte: d.texte || `Augmentation de ${d[cat]} mois (${d.article})` };
  }
  // Régime général des art. 643 (juridiction en métropole) et 644 (juridiction outre-mer).
  const regles = distance.regles;
  if (!estOutremer(lieuJuridiction, distance)) {
    const r = regles.juridiction_metropole;
    if (residence === 'etranger') return { mois: r.etranger.mois, article: 'art. 643, 2° CPC', texte: r.etranger.texte, verifie: true };
    if (estOutremer(residence, distance)) return { mois: r.outremer.mois, article: 'art. 643, 1° CPC', texte: r.outremer.texte, verifie: true };
    return null;
  }
  const r = regles.juridiction_outremer;
  if (residence === 'etranger') return { mois: r.etranger.mois, article: 'art. 644 CPC', texte: r.etranger.texte, verifie: true };
  if (residence !== lieuJuridiction) return { mois: r.autre_collectivite.mois, article: 'art. 644 CPC', texte: r.autre_collectivite.texte, verifie: true };
  return null;
}

// Fin du délai principal + augmentation, avant prorogation.
function finBrute(depart, duree, augMois, etapes, avertissements) {
  const mois = (duree.ans || 0) * 12 + (duree.mois || 0);
  const jours = duree.jours || 0;

  let e = depart;
  if (mois) {
    e = ajouterMois(depart, mois);
    const quantieme = Number(depart.slice(8));
    const clampe = Number(e.slice(8)) !== quantieme;
    etapes.push({
      article: 'art. 641 al. 2 CPC',
      texte: clampe
        ? `Ajout de ${libelleDuree({ ans: duree.ans, mois: duree.mois })} : aucun ${quantieme} dans le mois d'arrivée, le délai expire le dernier jour du mois, soit le ${formatLong(e)}.`
        : `Ajout de ${libelleDuree({ ans: duree.ans, mois: duree.mois })} : le délai expire le jour du mois qui porte le même quantième (${quantieme}), soit le ${formatLong(e)}.`,
      date: e,
    });
  }
  if (jours) {
    const avant = e;
    e = ajouterJours(e, jours);
    etapes.push({
      article: mois ? 'art. 641 al. 3 CPC' : 'art. 641 al. 1 CPC',
      texte: mois
        ? `Les mois sont décomptés d'abord, puis les jours : ${formatLong(avant)} + ${jours} jours = ${formatLong(e)}.`
        : `Décompte de ${jours} jours à partir du lendemain : le ${jours}e jour est le ${formatLong(e)}.`,
      date: e,
    });
  }
  if (!augMois) return e;

  // Méthode 1 : un délai unique (principal + augmentation), mois d'abord puis jours.
  const cumule = ajouterJours(ajouterMois(depart, mois + augMois), jours);
  // Méthode 2 : l'augmentation s'ajoute à la fin du délai principal.
  const successif = ajouterMois(e, augMois);
  const retenu = comparer(cumule, successif) <= 0 ? cumule : successif;
  etapes.push({
    article: 'art. 643 / 644 CPC',
    texte: `Augmentation de ${augMois} mois pour distance : échéance avant prorogation le ${formatLong(retenu)}.`,
    date: retenu,
  });
  if (cumule !== successif) {
    avertissements.push(`Selon la méthode, l'augmentation pour distance donne le ${formatLong(cumule)} (délai unique) ou le ${formatLong(successif)} (délais successifs). Par prudence, l'outil retient la date la plus proche, le ${formatLong(retenu)}.`);
  }
  return retenu;
}

/**
 * Calcule un délai.
 * @param {object} p
 *   typeId, dateDepart (ISO), duree et sens (délai personnalisé), dateImposee,
 *   residence, lieuJuridiction, zoneFeries, notifieSurPlace, joursChomes,
 *   interruption { dateDemande, dateNouveauDepart, motif }
 * @param {object} regles { catalogue, feries, distance }
 */
export function calculerDelai(p, regles) {
  const type = trouverType(regles.catalogue, p.typeId);
  const etapes = [];
  const avertissements = [];
  const zone = p.zoneFeries || 'metropole';
  const chomes = p.joursChomes || [];
  const duree = type.personnalise ? p.duree : type.duree;
  const sens = type.personnalise ? (p.sens || 'apres') : type.sens;
  const prorogation = type.personnalise ? p.prorogation !== false : type.prorogation !== false;

  if (!estDateISO(p.dateDepart) && !p.dateImposee) throw new Error('Date de départ manquante ou invalide.');
  if (type.verifie === false) avertissements.push(`Règle signalée comme « à vérifier » : ${type.note || 'texte récemment modifié.'}`);
  else if (type.note) avertissements.push(type.note);

  const base = {
    typeId: type.id, libelle: type.libelle, article: type.article, sanction: type.sanction,
    verifie: type.verifie !== false, duree, sens, depart: p.dateDepart, etapes, avertissements,
  };

  // Date imposée par une décision ou un calendrier de procédure.
  if (type.personnalise && p.dateImposee) {
    if (!estDateISO(p.dateImposee)) throw new Error('Date imposée invalide.');
    etapes.push({ article: type.article, texte: `Date fixée par la décision ou le calendrier de procédure : ${formatLong(p.dateImposee)}, à 24 h.`, date: p.dateImposee });
    const motif = motifNonOuvrable(p.dateImposee, zone, regles.feries, chomes);
    if (motif) avertissements.push(`La date imposée tombe un ${motif}. Vérifiez si la décision entend la proroger.`);
    return { ...base, echeanceBrute: p.dateImposee, echeance: p.dateImposee, distance: null };
  }

  if (!duree || !((duree.ans || 0) + (duree.mois || 0) + (duree.jours || 0))) throw new Error('Durée du délai manquante.');

  let depart = p.dateDepart;
  etapes.push({
    article: 'art. 640 et 641 al. 1 CPC',
    texte: sens === 'apres'
      ? `Point de départ : ${minusculeInitiale(type.depart)} le ${formatLong(depart)}. Ce jour ne compte pas.`
      : `Date de référence : ${minusculeInitiale(type.depart)} le ${formatLong(depart)}. Ce jour ne compte pas ; le délai se décompte à rebours.`,
    date: depart,
  });

  // --- Délai à rebours (« au moins N jours avant ») ---
  if (sens === 'avant') {
    const mois = (duree.ans || 0) * 12 + (duree.mois || 0);
    let e = ajouterJours(ajouterMois(depart, -mois), -(duree.jours || 0));
    etapes.push({ article: type.article, texte: `Recul de ${libelleDuree(duree)} : l'acte doit être accompli au plus tard le ${formatLong(e)}.`, date: e });
    const brute = e;
    let motif;
    while ((motif = motifNonOuvrable(e, zone, regles.feries, chomes))) {
      etapes.push({ article: 'prudence', texte: `Le ${formatLong(e)} est un ${motif} : on recule d'un jour.`, date: e });
      e = ajouterJours(e, -1);
    }
    if (e !== brute) avertissements.push("Délai à rebours tombant un jour non ouvrable : l'art. 642 ne prévoit pas de prorogation pour ces délais. L'outil avance l'échéance au dernier jour ouvrable précédent, par prudence.");
    return { ...base, echeanceBrute: brute, echeance: e, distance: null };
  }

  // --- Interruption (ex. demande d'aide juridictionnelle) ---
  let aug = augmentationDistance(type, p, regles.distance);
  if (p.interruption?.dateNouveauDepart) {
    const i = p.interruption;
    const initiale = finBrute(depart, duree, aug?.mois || 0, [], []);
    if (i.dateDemande && comparer(i.dateDemande, initiale) > 0) {
      avertissements.push(`La demande (${i.motif || 'cause d\'interruption'}) du ${formatLong(i.dateDemande)} est postérieure à l'expiration du délai initial (${formatLong(initiale)}) : elle ne peut pas l'avoir interrompu. Interruption ignorée.`);
    } else {
      depart = i.dateNouveauDepart;
      etapes.push({
        article: i.article || 'art. 43 du décret n° 2020-1717 du 28 décembre 2020',
        texte: `Interruption (${i.motif || 'aide juridictionnelle'}) : un nouveau délai complet court à compter du ${formatLong(depart)}.`,
        date: depart,
      });
      avertissements.push("Interruption pour aide juridictionnelle : vérifiez le point exact du nouveau délai (date de notification de la décision, expiration des recours contre celle-ci, désignation de l'auxiliaire de justice selon le cas).");
    }
  }

  if (aug) {
    etapes.push({ article: aug.article, texte: aug.texte });
    if (aug.verifie === false) avertissements.push(`L'augmentation pour distance (${aug.article}) est à vérifier dans la rédaction en vigueur.`);
    if (!aug.mois) aug = null;
  }

  const brute = finBrute(depart, duree, aug?.mois || 0, etapes, avertissements);
  etapes.push({ article: 'art. 642 al. 1 CPC', texte: `Le délai expire le ${formatLong(brute)} à 24 heures.`, date: brute });

  let e = brute;
  let motif = motifNonOuvrable(e, zone, regles.feries, chomes);
  if (motif && prorogation) {
    while ((motif = motifNonOuvrable(e, zone, regles.feries, chomes))) {
      etapes.push({ article: 'art. 642 al. 2 CPC', texte: `Le ${formatLong(e)} est un ${motif} : le délai est prorogé au jour suivant.`, date: e });
      e = ajouterJours(e, 1);
    }
    etapes.push({ article: 'art. 642 al. 2 CPC', texte: `Premier jour ouvrable : échéance reportée au ${formatLong(e)} à 24 heures.`, date: e });
  } else if (motif) {
    avertissements.push(`L'échéance tombe un ${motif}. Ce délai n'est pas un délai de procédure : la prorogation de l'art. 642 CPC n'est pas appliquée. Agissez au plus tard le dernier jour ouvrable précédent.`);
  }

  return { ...base, echeanceBrute: brute, echeance: e, distance: aug };
}

// Recalcule un délai d'affaire à partir de l'acte source et du contexte de l'affaire.
export function recalculerDelaiAffaire(delai, affaire, regles, joursChomes = []) {
  const acte = affaire.actes.find((a) => a.id === delai.acteId);
  const params = {
    typeId: delai.typeId,
    dateDepart: acte ? acte.date : delai.dateDepart,
    duree: delai.duree,
    sens: delai.sens,
    prorogation: delai.prorogation,
    dateImposee: delai.dateImposee,
    residence: delai.residence || affaire.contexte?.residence || 'metropole',
    lieuJuridiction: affaire.contexte?.lieuJuridiction || 'metropole',
    zoneFeries: affaire.contexte?.zoneFeries || 'metropole',
    notifieSurPlace: !!delai.notifieSurPlace,
    interruption: delai.interruption,
    joursChomes,
  };
  const r = calculerDelai(params, regles);
  return { ...delai, dateDepart: params.dateDepart, echeance: r.echeance, calcul: r };
}

export function verifierDate(iso) {
  parseISO(iso);
  return iso;
}
