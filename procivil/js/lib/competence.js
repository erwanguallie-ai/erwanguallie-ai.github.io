// Moteur de l'assistant de compétence : parcours d'un arbre de décision
// décrit dans data/competence.json, puis recherche de la juridiction précise
// à partir de la commune (data/communes.json et data/juridictions/*.json).

export function noeud(arbre, id) {
  const n = arbre.noeuds[id];
  if (!n) throw new Error(`Nœud inconnu : ${id}`);
  return { id, type: n.type || 'choix', ...n };
}

// Résultat complet (fusion avec le modèle éventuel, ajout du préalable amiable).
export function resultat(arbre, id) {
  const brut = arbre.resultats[id];
  if (!brut) throw new Error(`Résultat inconnu : ${id}`);
  const base = brut.modele ? { ...arbre.modeles[brut.modele] } : {};
  const r = { id, ...base, ...brut, notes: [...(base.notes || []), ...(brut.notes || [])], fondements: [...(base.fondements || []), ...(brut.fondements || [])] };
  if (r.prealable750) {
    r.prealable = `${arbre.prealable750.texte} (${arbre.prealable750.article}). ${arbre.prealable750.note}`;
  }
  r.regleTerritoriale = arbre.territorial[r.territorial] || arbre.territorial.defendeur;
  return r;
}

// Applique une réponse : retourne { suite } ou { resultat }.
export function repondre(arbre, idNoeud, reponse) {
  const n = noeud(arbre, idNoeud);
  if (n.type === 'montant') {
    const montant = Number(reponse);
    if (!Number.isFinite(montant) || montant < 0) throw new Error('Montant invalide.');
    const s = n.seuils.find((x) => x.max === null || montant <= x.max);
    return s.resultat ? { resultat: s.resultat } : { suite: s.suite };
  }
  const opt = n.options[Number(reponse)];
  if (!opt) throw new Error('Option invalide.');
  return opt.resultat ? { resultat: opt.resultat } : { suite: opt.suite };
}

// Rejoue un chemin de réponses depuis la racine (pour revenir en arrière).
export function parcourir(arbre, reponses) {
  let id = arbre.meta.debut;
  const chemin = [];
  for (const rep of reponses) {
    const n = noeud(arbre, id);
    const out = repondre(arbre, id, rep);
    chemin.push({ noeud: n, reponse: rep, libelle: n.type === 'montant' ? `${Number(rep).toLocaleString('fr-FR')} €` : n.options[rep].label });
    if (out.resultat) return { chemin, resultat: resultat(arbre, out.resultat) };
    id = out.suite;
  }
  return { chemin, courant: noeud(arbre, id) };
}

// --- Communes ---

const normaliser = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim();

export function indexerCommunes(donnees) {
  return donnees.c.map(([insee, nom, dep, cp]) => ({ insee, nom, dep, cp, cle: normaliser(nom) }));
}

export function chercherCommunes(index, saisie, max = 12) {
  const q = normaliser(saisie || '');
  if (q.length < 2) return [];
  if (/^\d{5}$/.test(q)) return index.filter((c) => c.cp === q || c.insee === q).slice(0, max);
  const debut = []; const contient = [];
  for (const c of index) {
    if (c.cle.startsWith(q)) debut.push(c);
    else if (c.cle.includes(q)) contient.push(c);
    if (debut.length >= max) break;
  }
  return [...debut, ...contient].slice(0, max);
}

// Juridiction précise pour une commune et un type (tj, cph, tc, ca).
export function juridictionPour(commune, type, juridictions, zones) {
  // Arrondissements municipaux de Paris, Lyon et Marseille : ressort de la commune.
  const parent = /^751\d\d$/.test(commune.insee) ? '75056' : /^6938\d$/.test(commune.insee) ? '69123' : /^132\d\d$/.test(commune.insee) ? '13055' : null;
  const j = juridictions.communes[commune.insee] || (parent && juridictions.communes[parent]);
  const zone = zones(commune.dep);
  const lien = `https://www.justice.fr/recherche/annuaires`;
  if (!j) {
    return {
      trouve: false, zone,
      texte: `${commune.nom} (${commune.dep}) ne figure pas dans l'échantillon de démonstration. Consultez l'annuaire officiel des juridictions.`,
      lien,
    };
  }
  const nom = j[type] || j.tj;
  const r = { trouve: true, zone, nom, coursAppel: j.ca, tae: !!j.tae, lien };
  if (type === 'tc' && zone === 'alsace-moselle') r.note = 'Alsace-Moselle : la matière commerciale relève de la chambre commerciale du tribunal judiciaire.';
  if (type === 'tc' && j.tae) r.note = "Ressort de l'expérimentation des tribunaux des activités économiques (2025-2028).";
  return r;
}
