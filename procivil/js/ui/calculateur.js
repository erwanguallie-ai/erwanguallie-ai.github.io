// Module 1 : calculateur de délais autonome (le résultat peut être ajouté à une affaire).
import { h, vider, champ, select, annoncer } from './dom.js';
import {
  lienRetour, selectTypeDelai, selectResidence, selectLieuJuridiction, selectZoneFeries, detailCalcul, bandeauAvertissement, badge, selectTypeActe,
} from './composants.js';
import { calculerDelai, trouverType, libelleDuree } from '../lib/delais.js';
import { joursRestants, niveau } from '../lib/alertes.js';
import { ajouterActe, ajouterDelai } from '../model.js';

export function vueCalculateur(app, idAffaire) {
  const { regles } = app;
  const aff = idAffaire ? app.affaire(idAffaire) : null;
  const f = {
    type: selectTypeDelai(regles.catalogue, 'appel_contentieux', { id: 'k-type' }),
    date: h('input', { type: 'date', id: 'k-date', value: app.aujourdhui }),
    residence: selectResidence(regles.distance, aff?.contexte.residence, { id: 'k-resid' }),
    lieu: selectLieuJuridiction(regles.distance, aff?.contexte.lieuJuridiction, { id: 'k-lieu' }),
    zone: selectZoneFeries(regles.feries, aff?.contexte.zoneFeries, { id: 'k-zone' }),
    surPlace: h('input', { type: 'checkbox', id: 'k-surplace' }),
    ajDemande: h('input', { type: 'date', id: 'k-aj-dem' }),
    ajDepart: h('input', { type: 'date', id: 'k-aj-dep' }),
    mois: h('input', { type: 'number', min: '0', id: 'k-mois', value: '0' }),
    jours: h('input', { type: 'number', min: '0', id: 'k-jours', value: '15' }),
    sens: select([{ value: 'apres', label: 'Après l\'événement' }, { value: 'avant', label: 'Avant l\'événement (à rebours)' }], 'apres', { id: 'k-sens' }),
    prorogation: h('input', { type: 'checkbox', id: 'k-prorog', checked: true }),
  };
  const infoType = h('div', { class: 'info-type' });
  const libre = h('div', { class: 'bloc-libre' });
  const resultat = h('div', { class: 'resultat-calcul', 'aria-live': 'polite' });
  let dernier = null;

  const params = () => {
    const t = trouverType(regles.catalogue, f.type.value);
    const p = {
      typeId: t.id, dateDepart: f.date.value, residence: f.residence.value, lieuJuridiction: f.lieu.value, zoneFeries: f.zone.value,
      notifieSurPlace: f.surPlace.checked, joursChomes: app.joursChomes(),
      interruption: f.ajDepart.value ? { dateDemande: f.ajDemande.value || null, dateNouveauDepart: f.ajDepart.value, motif: 'aide juridictionnelle' } : null,
    };
    if (t.personnalise) Object.assign(p, { duree: { mois: Number(f.mois.value) || 0, jours: Number(f.jours.value) || 0 }, sens: f.sens.value, prorogation: f.prorogation.checked });
    return p;
  };

  const calculer = () => {
    const t = trouverType(regles.catalogue, f.type.value);
    vider(infoType, h('p', {}, h('strong', {}, `${libelleDuree(t.duree)} `), `· départ : ${t.depart} · ${t.article} · sanction : ${t.sanction}`),
      t.verifie === false ? h('p', { class: 'a-verifier' }, '🔎 Règle signalée « à vérifier » (texte récemment modifié).') : null);
    libre.hidden = !t.personnalise;
    try {
      dernier = calculerDelai(params(), regles);
      const j = joursRestants(dernier.echeance, app.aujourdhui);
      const niv = niveau(j, app.etat.parametres.seuils);
      vider(resultat, 
        h('div', { class: `echeance-grande niveau-${niv}` }, h('span', { class: 'discret' }, 'Échéance'), h('strong', {}, `${dernier.echeance.split('-').reverse().join('/')} à 24 h`), badge(niv, j)),
        detailCalcul(dernier),
        blocAjout());
    } catch (e) {
      dernier = null;
      vider(resultat, h('p', { class: 'erreur', role: 'alert' }, e.message));
    }
  };

  const blocAjout = () => {
    if (!app.etat.affaires.length) return null;
    const cible = select(app.etat.affaires.filter((a) => a.statut !== 'cloturee').map((a) => ({ value: a.id, label: a.nom })), aff?.id || '', { id: 'k-aff' });
    const typeActe = selectTypeActe(regles.catalogue, 'autre', { id: 'k-acte' });
    const sugg = regles.catalogue.actes.find((x) => x.suggestions.includes(f.type.value));
    if (sugg) typeActe.value = sugg.id;
    return h('div', { class: 'ajout-affaire' },
      h('h3', {}, 'Ajouter ce délai à une affaire'),
      h('div', { class: 'grille-3 aligne-bas' }, champ({ label: 'Affaire', id: 'k-aff' }, cible), champ({ label: 'Acte de départ', id: 'k-acte' }, typeActe),
        h('button', { type: 'button', class: 'btn btn-principal', onclick: async () => {
          const a = app.affaire(cible.value);
          const p = params();
          const acte = ajouterActe(a, { type: typeActe.value, libelle: regles.catalogue.actes.find((x) => x.id === typeActe.value).libelle, date: p.dateDepart });
          ajouterDelai(a, { ...p, acteId: acte.id, residence: p.residence !== a.contexte.residence ? p.residence : null }, regles, app.joursChomes());
          if (a.contexte.lieuJuridiction !== p.lieuJuridiction || a.contexte.zoneFeries !== p.zoneFeries) annoncer('Attention : l\'affaire a d\'autres paramètres de lieu ou de jours fériés ; ce sont eux qui s\'appliquent dans la fiche.', 'info');
          await app.sauver('Délai ajouté à l\'affaire.');
          app.aller(`#/affaire/${a.id}`);
        } }, 'Ajouter')));
  };

  for (const el of Object.values(f)) el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', calculer);
  libre.append(h('div', { class: 'grille-3' }, champ({ label: 'Mois', id: 'k-mois' }, f.mois), champ({ label: 'Jours', id: 'k-jours' }, f.jours), champ({ label: 'Sens', id: 'k-sens' }, f.sens)),
    h('label', { class: 'case' }, f.prorogation, ' Appliquer la prorogation de l\'art. 642 al. 2'));
  calculer();

  return h('section', { class: 'vue vue-calculateur' },
    lienRetour(aff ? `#/affaire/${aff.id}` : '#/', aff ? aff.nom : 'Tableau de bord'),
    h('h1', {}, 'Calculateur de délais'),
    bandeauAvertissement(),
    h('div', { class: 'grille-calcul' },
      h('form', { class: 'carte formulaire', onsubmit: (e) => { e.preventDefault(); calculer(); } },
        champ({ label: 'Type de délai', id: 'k-type' }, f.type), infoType, libre,
        champ({ label: 'Date de l\'acte ou de l\'événement de départ', id: 'k-date', aide: 'Signification : date de l\'acte. Lettre recommandée : date de réception (art. 668 CPC).' }, f.date),
        champ({ label: 'Lieu de résidence de la partie qui doit agir', id: 'k-resid' }, f.residence),
        champ({ label: 'Siège de la juridiction', id: 'k-lieu' }, f.lieu),
        champ({ label: 'Jours fériés applicables', id: 'k-zone' }, f.zone),
        h('label', { class: 'case' }, f.surPlace, ' Acte remis à la personne dans un lieu sans délai de distance (art. 647)'),
        h('details', {}, h('summary', {}, 'Interruption par une demande d\'aide juridictionnelle'),
          h('p', { class: 'aide' }, 'Art. 43 du décret n° 2020-1717 : renseignez la date de la demande et le point de départ du nouveau délai.'),
          champ({ label: 'Date de la demande', id: 'k-aj-dem' }, f.ajDemande),
          champ({ label: 'Point de départ du nouveau délai', id: 'k-aj-dep' }, f.ajDepart))),
      h('div', { class: 'carte' }, h('h2', {}, 'Résultat'), resultat)));
}
