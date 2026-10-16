// Jeu de tests partagé entre le navigateur (tests.html) et Node (tests/run-node.mjs).
// Les résultats attendus ont été établis à la main, à partir des textes
// (art. 640 à 647 CPC) et du calendrier, indépendamment du code testé.
import { calculerDelai } from '../js/lib/delais.js';
import { paques, motifNonOuvrable } from '../js/lib/feries.js';
import {
  niveau, validerSeuils, trierAffaires, delaiPrioritaire, libelleEcheance, SEUILS_DEFAUT,
} from '../js/lib/alertes.js';
import { ajouterMois, depuisTexteFR } from '../js/lib/dates.js';
import { extraireInformations } from '../js/lib/extraction.js';
import { parcourir, juridictionPour } from '../js/lib/competence.js';

export const CAS_DELAIS = [
  { n: 1, titre: "Appel (1 mois) expirant un samedi : prorogation au lundi",
    p: { typeId: 'appel_contentieux', dateDepart: '2025-01-15' }, attendu: '2025-02-17',
    explication: '15/01 + 1 mois = samedi 15/02 → lundi 17/02 (art. 641 et 642)' },
  { n: 2, titre: 'Fin de mois : 31 janvier + 1 mois (année non bissextile)',
    p: { typeId: 'appel_contentieux', dateDepart: '2025-01-31' }, attendu: '2025-02-28',
    explication: "Pas de 31 février : dernier jour du mois, vendredi 28/02 (art. 641 al. 2)" },
  { n: 3, titre: 'Année bissextile : 31 janvier 2024 + 1 mois',
    p: { typeId: 'appel_contentieux', dateDepart: '2024-01-31' }, attendu: '2024-02-29',
    explication: 'Jeudi 29/02/2024' },
  { n: 4, titre: 'Pourvoi (2 mois) depuis le 30 décembre 2023 (bissextile)',
    p: { typeId: 'pourvoi', dateDepart: '2023-12-30' }, attendu: '2024-02-29',
    explication: 'Pas de 30 février : dernier jour du mois, jeudi 29/02/2024 (art. 612 et 641)' },
  { n: 5, titre: 'Référé (15 jours) expirant le lundi de Pâques',
    p: { typeId: 'appel_refere', dateDepart: '2025-04-06' }, attendu: '2025-04-22',
    explication: 'Le 15e jour est le lundi 21/04/2025 (lundi de Pâques) → mardi 22/04' },
  { n: 6, titre: 'Appel expirant le 11 novembre (mardi férié)',
    p: { typeId: 'appel_contentieux', dateDepart: '2025-10-11' }, attendu: '2025-11-12',
    explication: '11/11/2025 férié → mercredi 12/11' },
  { n: 7, titre: 'Samedi, dimanche puis lundi de Pentecôte',
    p: { typeId: 'appel_refere', dateDepart: '2025-05-23' }, attendu: '2025-06-10',
    explication: 'Samedi 07/06, dimanche 08/06, lundi de Pentecôte 09/06 → mardi 10/06/2025' },
  { n: 8, titre: '26 décembre en métropole (jour ouvrable)',
    p: { typeId: 'appel_contentieux', dateDepart: '2025-11-26' }, attendu: '2025-12-26',
    explication: 'Vendredi 26/12/2025, ouvrable hors Alsace-Moselle' },
  { n: 9, titre: '26 décembre en Alsace-Moselle (férié local)',
    p: { typeId: 'appel_contentieux', dateDepart: '2025-11-26', zoneFeries: 'alsace-moselle' }, attendu: '2025-12-29',
    explication: 'Saint-Étienne férié (L. 3134-13 C. trav.), puis week-end → lundi 29/12/2025' },
  { n: 10, titre: 'Vendredi saint en Alsace-Moselle puis week-end et lundi de Pâques',
    p: { typeId: 'appel_refere', dateDepart: '2025-04-03', zoneFeries: 'alsace-moselle' }, attendu: '2025-04-22',
    explication: 'Vendredi saint 18/04, samedi, dimanche, lundi de Pâques 21/04 → mardi 22/04/2025' },
  { n: 11, titre: 'Même délai en métropole : le Vendredi saint est ouvrable',
    p: { typeId: 'appel_refere', dateDepart: '2025-04-03' }, attendu: '2025-04-18',
    explication: 'Vendredi 18/04/2025' },
  { n: 12, titre: 'Délai de distance : partie demeurant à La Réunion, juridiction en métropole',
    p: { typeId: 'appel_contentieux', dateDepart: '2025-03-10', residence: 'reunion' }, attendu: '2025-05-12',
    explication: '1 mois + 1 mois (art. 643, 1°) = samedi 10/05 → lundi 12/05/2025' },
  { n: 13, titre: 'Distance étranger en fin de mois : divergence des méthodes, la plus proche retenue',
    p: { typeId: 'appel_contentieux', dateDepart: '2025-01-31', residence: 'etranger' }, attendu: '2025-04-28', avertissement: /méthode/,
    explication: 'Délai unique (3 mois) : 30/04 ; délais successifs : 28/02 + 2 mois = 28/04 → 28/04/2025 retenu' },
  { n: 14, titre: 'Art. 644 : juridiction à La Réunion, partie en métropole',
    p: { typeId: 'appel_contentieux', dateDepart: '2025-03-03', residence: 'metropole', lieuJuridiction: 'reunion', zoneFeries: 'reunion' }, attendu: '2025-05-05',
    explication: '1 + 1 mois = samedi 03/05 → lundi 05/05/2025' },
  { n: 15, titre: 'Art. 647 : notification à personne sur place, pas d\'augmentation',
    p: { typeId: 'appel_contentieux', dateDepart: '2025-03-03', residence: 'etranger', notifieSurPlace: true }, attendu: '2025-04-03',
    explication: 'Jeudi 03/04/2025' },
  { n: 16, titre: 'Constitution du défendeur (15 jours) expirant un samedi',
    p: { typeId: 'constitution_defendeur', dateDepart: '2026-02-13' }, attendu: '2026-03-02',
    explication: 'Samedi 28/02/2026 → lundi 02/03/2026 (art. 755 et 642)' },
  { n: 17, titre: 'Délai à rebours (remise de l\'assignation) tombant un dimanche',
    p: { typeId: 'remise_assignation', dateDepart: '2026-03-16' }, attendu: '2026-02-27', avertissement: /rebours/,
    explication: 'Audience lundi 16/03 − 15 jours = dimanche 01/03 → vendredi 27/02/2026 par prudence' },
  { n: 18, titre: 'Prescription (12 mois) : pas de prorogation de l\'art. 642',
    p: { typeId: 'contestation_licenciement', dateDepart: '2025-03-15' }, attendu: '2026-03-15', avertissement: /prorogation/,
    explication: 'Dimanche 15/03/2026, avec avertissement' },
  { n: 19, titre: 'Déclaration de créances : créancier à l\'étranger (2 + 2 mois)',
    p: { typeId: 'declaration_creances', dateDepart: '2026-01-10', residence: 'etranger' }, attendu: '2026-05-11',
    explication: 'Dimanche 10/05/2026 → lundi 11/05 (R. 622-24 C. com.)' },
  { n: 20, titre: 'Péremption (2 ans) depuis un 29 février',
    p: { typeId: 'peremption', dateDepart: '2024-02-29' }, attendu: '2026-03-02',
    explication: 'Pas de 29/02/2026 : samedi 28/02 → lundi 02/03/2026' },
  { n: 21, titre: 'Lundi de Pentecôte 2026',
    p: { typeId: 'appel_refere', dateDepart: '2026-05-10' }, attendu: '2026-05-26',
    explication: 'Lundi 25/05/2026 (Pentecôte) → mardi 26/05' },
  { n: 22, titre: 'Interruption par une demande d\'aide juridictionnelle',
    p: { typeId: 'appel_contentieux', dateDepart: '2026-01-05', interruption: { dateDemande: '2026-01-20', dateNouveauDepart: '2026-03-02', motif: 'aide juridictionnelle' } }, attendu: '2026-04-02',
    explication: 'Nouveau délai d\'un mois à compter du 02/03 → jeudi 02/04/2026' },
  { n: 23, titre: 'Demande d\'aide juridictionnelle tardive : sans effet',
    p: { typeId: 'appel_contentieux', dateDepart: '2026-01-05', interruption: { dateDemande: '2026-02-10', dateNouveauDepart: '2026-03-02' } }, attendu: '2026-02-05', avertissement: /postérieure/,
    explication: 'Délai initial expiré le jeudi 05/02/2026' },
  { n: 24, titre: 'Jour chômé saisi par l\'avocat',
    p: { typeId: 'appel_contentieux', dateDepart: '2026-06-03', joursChomes: [{ date: '2026-07-03', libelle: 'Greffe fermé' }] }, attendu: '2026-07-06',
    explication: 'Vendredi 03/07 chômé, puis week-end → lundi 06/07/2026' },
  { n: 25, titre: 'Guadeloupe : 27 mai férié (abolition de l\'esclavage)',
    p: { typeId: 'appel_refere', dateDepart: '2026-05-12', lieuJuridiction: 'guadeloupe', residence: 'guadeloupe', zoneFeries: 'guadeloupe' }, attendu: '2026-05-28',
    explication: 'Mercredi 27/05/2026 férié → jeudi 28/05' },
  { n: 26, titre: 'Délai personnalisé « 2 mois et 10 jours » : mois puis jours',
    p: { typeId: 'libre', dateDepart: '2026-01-31', duree: { mois: 2, jours: 10 }, sens: 'apres' }, attendu: '2026-04-10',
    explication: '31/01 + 2 mois = 31/03, + 10 jours = vendredi 10/04/2026 (art. 641 al. 3)' },
  { n: 27, titre: 'Changement d\'année : 15 jours depuis le 20 décembre 2025',
    p: { typeId: 'appel_refere', dateDepart: '2025-12-20' }, attendu: '2026-01-05',
    explication: 'Le 15e jour est le dimanche 04/01/2026 → lundi 05/01/2026' },
];

function verifier(tests, nom, ok, detail) {
  tests.push({ groupe: nom.groupe, titre: nom.titre, ok: !!ok, detail });
}

export function executerTests(regles, aujourdhui = '2026-10-16') {
  const res = [];

  for (const c of CAS_DELAIS) {
    let r; let err;
    try { r = calculerDelai(c.p, regles); } catch (e) { err = e; }
    const ok = !err && r.echeance === c.attendu && (!c.avertissement || r.avertissements.some((a) => c.avertissement.test(a)));
    verifier(res, { groupe: 'Calcul des délais', titre: `${c.n}. ${c.titre}` }, ok,
      err ? `Erreur : ${err.message}` : `attendu ${c.attendu}, obtenu ${r.echeance}. ${c.explication}`);
  }

  // Pâques
  const pq = { 2000: '2000-04-23', 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2038: '2038-04-25' };
  for (const [a, d] of Object.entries(pq)) {
    verifier(res, { groupe: 'Jours fériés', titre: `Pâques ${a}` }, paques(Number(a)) === d, `attendu ${d}, obtenu ${paques(Number(a))}`);
  }
  verifier(res, { groupe: 'Jours fériés', titre: 'Ascension 2026 (14 mai) non ouvrable' },
    /Ascension/.test(motifNonOuvrable('2026-05-14', 'metropole', regles.feries) || ''), motifNonOuvrable('2026-05-14', 'metropole', regles.feries));
  verifier(res, { groupe: 'Jours fériés', titre: 'Lundi 4 mai 2026 ouvrable' },
    motifNonOuvrable('2026-05-04', 'metropole', regles.feries) === null, String(motifNonOuvrable('2026-05-04', 'metropole', regles.feries)));
  verifier(res, { groupe: 'Dates', titre: '31 août + 1 mois = 30 septembre' }, ajouterMois('2026-08-31', 1) === '2026-09-30', ajouterMois('2026-08-31', 1));
  verifier(res, { groupe: 'Dates', titre: 'Lecture « 1er mars 2026 » et « 05/03/26 »' },
    depuisTexteFR('1er mars 2026') === '2026-03-01' && depuisTexteFR('05/03/26') === '2026-03-05', `${depuisTexteFR('1er mars 2026')} / ${depuisTexteFR('05/03/26')}`);
  verifier(res, { groupe: 'Dates', titre: 'Date impossible refusée (31/02/2026)' }, depuisTexteFR('31/02/2026') === null, String(depuisTexteFR('31/02/2026')));

  // Niveaux d'alerte, seuils par défaut 3 / 7
  const attendus = [[-5, 'expire'], [-1, 'expire'], [0, 'rouge'], [3, 'rouge'], [4, 'orange'], [7, 'orange'], [8, 'normal'], [null, 'aucun']];
  for (const [j, n] of attendus) {
    verifier(res, { groupe: "Niveaux d'alerte (seuils 3 / 7)", titre: `${j === null ? 'sans délai' : `${j} jour(s)`} → ${n}` }, niveau(j, SEUILS_DEFAUT) === n, `obtenu ${niveau(j, SEUILS_DEFAUT)}`);
  }
  // Modification des seuils
  const s = { rouge: 5, orange: 10 };
  for (const [j, n] of [[5, 'rouge'], [6, 'orange'], [10, 'orange'], [11, 'normal']]) {
    verifier(res, { groupe: 'Seuils modifiés (5 / 10)', titre: `${j} jours → ${n}` }, niveau(j, s) === n, `obtenu ${niveau(j, s)}`);
  }
  verifier(res, { groupe: 'Seuils modifiés (5 / 10)', titre: 'Le même délai change de niveau quand les seuils changent' },
    niveau(4, SEUILS_DEFAUT) === 'orange' && niveau(4, s) === 'rouge', `${niveau(4, SEUILS_DEFAUT)} → ${niveau(4, s)}`);

  // Validation des seuils
  const v = [
    [3, 7, true, 'valeurs par défaut'], [0, 1, true, 'rouge 0, orange 1'],
    [5, 5, false, 'orange égal au rouge'], [6, 4, false, 'orange inférieur au rouge'],
    [-1, 7, false, 'rouge négatif'], [2.5, 7, false, 'rouge non entier'], ['', 7, false, 'rouge vide'], [3, 400, false, 'orange > 365'],
  ];
  for (const [r, o, ok, t] of v) {
    const out = validerSeuils(r, o);
    verifier(res, { groupe: 'Contrôle de cohérence des seuils', titre: `${t} (${r} / ${o}) → ${ok ? 'accepté' : 'refusé'}` }, out.ok === ok, out.erreurs.join(' ') || 'accepté');
  }
  const msg = validerSeuils(6, 4).erreurs[0] || '';
  verifier(res, { groupe: 'Contrôle de cohérence des seuils', titre: 'Message d\'erreur explicite' }, /strictement supérieur/.test(msg), msg);

  // Tri par priorité
  const aff = (id, nom, ...ech) => ({ id, nom, delais: ech.map((e, i) => (typeof e === 'string' ? { id: `${id}${i}`, echeance: e, statut: 'a_faire' } : e)) });
  const liste = [
    aff('A', 'Affaire lointaine', '2026-11-30'),
    aff('B', 'Affaire expirée', '2026-10-10'),
    aff('C', 'Zeta urgente', '2026-10-17'),
    aff('D', 'Sans délai'),
    aff('E', 'Alpha urgente', '2026-10-17'),
    aff('F', 'Délai accompli seulement', { id: 'F0', echeance: '2026-10-01', statut: 'accompli' }),
    aff('G', 'Plusieurs délais', '2026-12-01', '2026-10-20'),
  ];
  const ordre = trierAffaires(liste, aujourdhui).map((x) => x.affaire.id).join('');
  verifier(res, { groupe: 'Tri par priorité', titre: 'Expirée, puis échéances croissantes, égalités par nom, sans délai en dernier' },
    ordre === 'BECGAFD', `attendu BECGAFD, obtenu ${ordre}`);
  const g = delaiPrioritaire(liste[6], aujourdhui);
  verifier(res, { groupe: 'Tri par priorité', titre: "Le délai le plus proche d'une affaire est retenu" }, g.delai.echeance === '2026-10-20', g.delai.echeance);
  verifier(res, { groupe: 'Tri par priorité', titre: 'Un délai accompli est ignoré' }, delaiPrioritaire(liste[5], aujourdhui) === null, 'null attendu');

  // Libellés
  for (const [j, l] of [[0, "Expire aujourd'hui à 24 h"], [1, 'Expire demain à 24 h'], [2, 'Expire dans 2 jours'], [-3, 'Expiré depuis 3 jours']]) {
    verifier(res, { groupe: 'Libellés', titre: `${j} → « ${l} »` }, libelleEcheance(j) === l, libelleEcheance(j));
  }

  // Extraction de texte (module 3)
  const txt = `ACTE DE SIGNIFICATION D'UN JUGEMENT
L'an deux mille vingt-six et le 3 mars 2026, à la requête de la SCI Les Tilleuls,
j'ai, Maître Dupont, commissaire de justice, signifié à :
Monsieur Jean MARTIN, demeurant 12 rue des Lilas 69003 Lyon,
le jugement rendu le 12/02/2026 par le Tribunal judiciaire de Lyon.`;
  const ex = extraireInformations(txt);
  verifier(res, { groupe: 'Extraction de document', titre: "Nature de l'acte : signification d'un jugement" }, ex.nature?.valeur === 'signification_jugement', ex.nature?.valeur);
  verifier(res, { groupe: 'Extraction de document', titre: 'Date de signification' }, ex.dateActe?.valeur === '2026-03-03', ex.dateActe?.valeur);
  verifier(res, { groupe: 'Extraction de document', titre: 'Juridiction mentionnée' }, /judiciaire de Lyon/i.test(ex.juridiction?.valeur || ''), ex.juridiction?.valeur);
  verifier(res, { groupe: 'Extraction de document', titre: 'Commune du destinataire (code postal)' }, ex.domicile?.codePostal === '69003', JSON.stringify(ex.domicile));

  // Assistant de compétence (si les données sont fournies)
  if (regles.competence) {
    const arbre = regles.competence;
    const G = 'Assistant de compétence';
    const r1 = parcourir(arbre, [13, 1, 0, 4000]).resultat;
    verifier(res, { groupe: G, titre: 'Contrat entre particuliers, 4 000 € → TJ, préalable amiable (art. 750-1)' }, r1?.code === 'TJ' && /750-1/.test(r1.prealable || '') && /761/.test(r1.representation), r1 && `${r1.code} · ${r1.representation}`);
    const r2 = parcourir(arbre, [13, 1, 0, 15000]).resultat;
    verifier(res, { groupe: G, titre: '15 000 € → représentation obligatoire (art. 760), pas de préalable' }, /760/.test(r2?.representation || '') && !r2.prealable, r2?.representation);
    const r3 = parcourir(arbre, [0]).resultat;
    verifier(res, { groupe: G, titre: 'Contrat de travail → conseil de prud\'hommes (R. 1412-1 C. trav.)' }, r3?.code === 'CPH' && r3.regleTerritoriale.fondements.some((f) => /R\. 1412-1/.test(f.article)), r3?.libelle);
    const r4 = parcourir(arbre, [7, 1]).resultat;
    verifier(res, { groupe: G, titre: 'Agriculteur en difficulté → TJ, ou TAE dans les ressorts de l\'expérimentation' }, r4?.code === 'TJ' && r4.tae === true, r4?.libelle);
    const r5 = parcourir(arbre, [13, 1, 1, 20000]).resultat;
    verifier(res, { groupe: G, titre: 'Délictuel → options de l\'art. 46 (fait dommageable, dommage subi)' }, r5?.regleTerritoriale.lieux.length === 3, r5?.regleTerritoriale.libelle);
    if (regles.juridictions) {
      const zones = (dep) => (['57', '67', '68'].includes(dep) ? 'alsace-moselle' : 'metropole');
      const j1 = juridictionPour({ insee: '69383', nom: 'Lyon 3e Arrondissement', dep: '69' }, 'tj', regles.juridictions, zones);
      verifier(res, { groupe: G, titre: 'Lyon 3e arrondissement → tribunal judiciaire de Lyon' }, j1.nom === 'Tribunal judiciaire de Lyon', j1.nom || j1.texte);
      const j2 = juridictionPour({ insee: '67482', nom: 'Strasbourg', dep: '67' }, 'tc', regles.juridictions, zones);
      verifier(res, { groupe: G, titre: 'Strasbourg, matière commerciale → chambre commerciale du TJ' }, /Chambre commerciale/.test(j2.nom) && j2.zone === 'alsace-moselle', j2.nom);
      const j3 = juridictionPour({ insee: '68066', nom: 'Colmar', dep: '68' }, 'tj', regles.juridictions, zones);
      verifier(res, { groupe: G, titre: 'Commune hors échantillon → renvoi vers l\'annuaire officiel' }, j3.trouve === false && j3.zone === 'alsace-moselle', j3.texte);
    }
  }

  return res;
}
