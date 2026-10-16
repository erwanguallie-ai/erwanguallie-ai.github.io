// Module 2 : assistant de compétence juridictionnelle (arbre de décision).
import { h, vider, champ, annoncer } from './dom.js';
import { lienRetour, champCommune, bandeauAvertissement } from './composants.js';
import { parcourir, juridictionPour } from '../lib/competence.js';
import { creerAffaire } from '../model.js';

export function vueCompetence(app, idAffaire, initial = {}) {
  const arbre = app.regles.competence;
  const aff = idAffaire ? app.affaire(idAffaire) : null;
  const reponses = [...(initial.reponses || [])];
  if (aff?.parties?.communeDefendeur && !initial.communes) initial.communes = { defendeur: aff.parties.communeDefendeur };
  const lieux = {}; // id du lieu -> { commune, juridiction }
  const racine = h('section', { class: 'vue vue-competence' });
  const zone = h('div', {});

  const rendre = () => {
    for (const k of Object.keys(lieux)) delete lieux[k];
    const etat = parcourir(arbre, reponses);
    const fil = etat.chemin.length ? h('ol', { class: 'fil-reponses' }, etat.chemin.map((c, i) => h('li', {},
      h('span', { class: 'discret' }, c.noeud.question), ' ', h('strong', {}, c.libelle), ' ',
      h('button', { type: 'button', class: 'btn btn-petit', onclick: () => { reponses.length = i; rendre(); } }, 'Modifier')))) : null;
    vider(zone, fil, etat.resultat ? vueResultat(etat.resultat) : vueQuestion(etat.courant));
    zone.querySelector('h2')?.focus();
  };

  const vueQuestion = (n) => {
    if (n.type === 'montant') {
      const input = h('input', { type: 'number', min: '0', step: '0.01', id: 'q-montant', inputmode: 'decimal', value: initial.montant ?? '' });
      return h('form', { class: 'carte question', onsubmit: (e) => { e.preventDefault(); if (input.value === '' || Number(input.value) < 0) { annoncer('Indiquez un montant positif.', 'erreur'); return; } reponses.push(Number(input.value)); rendre(); } },
        h('h2', { tabindex: '-1' }, n.question), n.aide ? h('p', { class: 'aide' }, n.aide) : null,
        champ({ label: 'Montant en euros', id: 'q-montant' }, input),
        h('button', { type: 'submit', class: 'btn btn-principal' }, 'Continuer'));
    }
    return h('div', { class: 'carte question', role: 'group', 'aria-labelledby': 'q-titre' },
      h('h2', { id: 'q-titre', tabindex: '-1' }, n.question), n.aide ? h('p', { class: 'aide' }, n.aide) : null,
      h('div', { class: 'options-question' }, n.options.map((o, i) => h('button', { type: 'button', class: 'btn btn-option', onclick: () => { reponses.push(i); rendre(); } }, o.label))));
  };

  const vueResultat = (r) => {
    const rt = r.regleTerritoriale;
    const res = h('div', { class: 'resultats-lieux', 'aria-live': 'polite' });
    const majLieu = async (lieu, commune) => {
      const { juridictions } = await app.chargerCommunes();
      let type = r.type;
      // TAE : compétent pour les procédures collectives quel que soit le statut du débiteur
      if (r.tae && juridictionPour(commune, 'tc', juridictions, (dep) => app.zoneDepuisDep(dep)).tae) type = 'tc';
      lieux[lieu.id] = { commune, juridiction: juridictionPour(commune, type, juridictions, (dep) => app.zoneDepuisDep(dep)) };
      afficherLieux();
    };
    const afficherLieux = () => vider(res, ...Object.entries(lieux).map(([id, { commune, juridiction: j }]) => {
      const lieu = rt.lieux.find((x) => x.id === id);
      return h('div', { class: `carte-lieu ${j.trouve ? '' : 'non-trouve'}` },
        h('p', { class: 'discret' }, `${lieu.libelle} : ${commune.nom} (${commune.dep})`),
        j.trouve ? h('p', {}, h('strong', {}, j.nom), j.coursAppel ? h('span', { class: 'discret' }, ` · appel : ${j.coursAppel}`) : null) : h('p', {}, j.texte),
        j.note ? h('p', { class: 'aide' }, j.note) : null,
        h('p', { class: 'aide' }, `Jours fériés : ${app.regles.feries.zones[j.zone]?.libelle}.`, ' ', h('a', { href: j.lien, target: '_blank', rel: 'noopener noreferrer' }, 'Vérifier dans l\'annuaire officiel ↗')),
        h('button', { type: 'button', class: 'btn btn-principal', onclick: () => enregistrer(r, lieu, commune, j) }, aff ? 'Retenir pour cette affaire' : 'Créer une affaire avec cette juridiction'));
    }));

    for (const l of rt.lieux) if (initial.communes?.[l.id] && !lieux[l.id]) majLieu(l, initial.communes[l.id]);
    if (Object.keys(lieux).length) setTimeout(afficherLieux, 0);
    return h('div', { class: 'carte resultat-competence' },
      h('h2', { tabindex: '-1' }, 'Juridiction compétente'),
      h('p', { class: 'resultat-principal' }, h('span', { 'aria-hidden': 'true' }, '⚖ '), r.libelle),
      h('h3', {}, 'Compétence matérielle'),
      h('ul', {}, r.fondements.map((f) => h('li', {}, h('strong', {}, f.article), ' — ', f.texte, f.verifie === false ? h('span', { class: 'a-verifier' }, ' (numérotation à vérifier)') : null))),
      r.representation ? h('p', {}, h('strong', {}, 'Représentation : '), r.representation) : null,
      r.prealable ? h('p', { class: 'avertissements' }, h('strong', {}, 'Préalable obligatoire : '), r.prealable) : null,
      r.notes.length ? h('ul', { class: 'aide' }, r.notes.map((n) => h('li', {}, n))) : null,
      h('h3', {}, `Compétence territoriale — ${rt.libelle}`),
      h('ul', {}, rt.fondements.map((f) => h('li', {}, h('strong', {}, f.article), ' — ', f.texte, f.verifie === false ? h('span', { class: 'a-verifier' }, ' (à vérifier)') : null))),
      rt.lieux.length > 1 ? h('p', { class: 'aide' }, 'Plusieurs rattachements sont possibles (option du demandeur) : renseignez une ou plusieurs communes pour comparer.') : null,
      h('div', { class: 'grille-2' }, rt.lieux.map((l) => champCommune(app, { id: `lieu-${l.id}`, label: l.libelle, valeur: initial.communes?.[l.id], onChoix: (c) => majLieu(l, c) }))),
      res,
      h('p', { class: 'aide' }, app.juridictions?.meta?.complet === false || !app.juridictions ? 'La correspondance commune → juridiction repose sur un échantillon de démonstration (principales villes). Pour les autres communes, l\'outil indique la zone de jours fériés et renvoie vers l\'annuaire officiel.' : ''),
      h('p', { class: 'aide' }, arbre.meta.avertissement));
  };

  const enregistrer = async (r, lieu, commune, j) => {
    const juridiction = {
      libelle: r.libelle, code: r.code, nomPrecis: j.trouve ? j.nom : `${r.libelle} — ${commune.nom}`,
      commune: { insee: commune.insee, nom: commune.nom, dep: commune.dep },
      rattachement: lieu.libelle,
      fondements: [...r.fondements, ...r.regleTerritoriale.fondements].map((f) => ({ article: f.article, texte: f.texte })),
      determineLe: app.aujourdhui, coursAppel: j.coursAppel || null,
    };
    const resid = app.regles.distance.departementsVersResidence[commune.dep];
    const contexte = { zoneFeries: j.zone, lieuJuridiction: resid && resid !== 'taaf' ? resid : 'metropole' };
    let a = aff;
    if (!a) {
      a = creerAffaire({ nom: initial.nom || `Nouvelle affaire — ${juridiction.nomPrecis}`, ...contexte });
      app.etat.affaires.push(a);
    }
    a.juridiction = juridiction;
    a.contexte = { ...a.contexte, ...contexte };
    const { recalculerAffaire } = await import('../model.js');
    recalculerAffaire(a, app.regles, app.joursChomes());
    await app.sauver(`Juridiction enregistrée dans la fiche : ${juridiction.nomPrecis}.`);
    app.aller(`#/affaire/${a.id}`);
  };

  rendre();
  racine.append(
    lienRetour(aff ? `#/affaire/${aff.id}` : '#/', aff ? aff.nom : 'Tableau de bord'),
    h('h1', {}, 'Assistant de compétence'),
    aff ? h('p', { class: 'discret' }, `Pour l'affaire : ${aff.nom}`) : null,
    bandeauAvertissement(),
    zone);
  return racine;
}

