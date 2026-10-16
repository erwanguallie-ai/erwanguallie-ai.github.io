// Page 1 : tableau de bord des affaires, triées par priorité.
import { h, vider } from './dom.js';
import { trierAffaires, niveau, seuilsAffaire } from '../lib/alertes.js';
import { ecartJours } from '../lib/dates.js';
import { badge, bandeauAvertissement, dateCourte, dateLongue } from './composants.js';

export function vueTableau(app) {
  const { etat, aujourdhui } = app;
  const seuils = etat.parametres.seuils;
  let filtre = '';
  let voirCloturees = false;

  const corps = h('div', { class: 'liste-affaires' });
  const compteurs = h('div', { class: 'compteurs', 'aria-live': 'polite' });

  const rendre = () => {
    const q = filtre.toLowerCase();
    const visibles = etat.affaires.filter((a) => (voirCloturees || a.statut !== 'cloturee')
      && (!q || [a.nom, a.parties?.demandeur, a.parties?.defendeur, a.juridiction?.nomPrecis, a.juridiction?.libelle, a.reference, a.rg].join(' ').toLowerCase().includes(q)));
    const tries = trierAffaires(visibles, aujourdhui);
    const n = { expire: 0, rouge: 0, orange: 0, normal: 0, aucun: 0 };
    const lignes = tries.map(({ affaire, prio }) => {
      const s = seuilsAffaire(affaire, seuils);
      const niv = prio ? niveau(prio.jours, s) : 'aucun';
      n[niv] += 1;
      return ligne(affaire, prio, niv);
    });
    vider(compteurs, 
      compteur('expire', n.expire, 'expiré(s)'),
      compteur('rouge', n.rouge, 'urgent(s)'),
      compteur('orange', n.orange, 'à surveiller'),
      compteur('normal', n.normal + n.aucun, 'autre(s)'),
    );
    vider(corps, 
      lignes.length ? h('table', { class: 'table-affaires' },
        h('caption', { class: 'visually-hidden' }, 'Affaires en cours, de l\'échéance la plus proche à la plus lointaine'),
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Affaire'), h('th', { scope: 'col' }, 'Juridiction'),
          h('th', { scope: 'col' }, 'Prochain délai'), h('th', { scope: 'col' }, 'Échéance'), h('th', { scope: 'col' }, 'Jours restants'))),
        h('tbody', {}, lignes))
        : h('div', { class: 'vide' }, h('p', {}, etat.affaires.length ? 'Aucune affaire ne correspond au filtre.' : 'Aucune affaire. Créez votre première affaire.'),
          h('a', { class: 'btn btn-principal', href: '#/nouvelle' }, '+ Nouvelle affaire')),
    );
  };

  const ligne = (a, prio, niv) => {
    const lien = `#/affaire/${a.id}`;
    const ouvrir = () => app.aller(lien);
    const d = prio?.delai;
    return h('tr', { class: `ligne-affaire niveau-${niv}`, tabindex: '-1', onclick: (e) => { if (!e.target.closest('a')) ouvrir(); } },
      h('td', { 'data-label': 'Affaire' },
        h('a', { href: lien, class: 'nom-affaire' }, a.nom),
        h('div', { class: 'discret' }, [a.reference && `Réf. ${a.reference}`, a.rg && `RG ${a.rg}`].filter(Boolean).join(' · ')),
        a.statut === 'cloturee' ? h('span', { class: 'etiquette' }, 'Clôturée') : null),
      h('td', { 'data-label': 'Juridiction' }, a.juridiction?.nomPrecis || a.juridiction?.libelle || h('span', { class: 'discret' }, 'Non renseignée')),
      h('td', { 'data-label': 'Prochain délai' }, d ? h('div', {}, d.libelle, h('div', { class: 'discret' }, d.article)) : h('span', { class: 'discret' }, 'Aucun délai en cours'),
        prio && prio.jours < 0 && prio.suivant ? h('div', { class: 'discret' }, `Puis : ${prio.suivant.libelle} (${dateCourte(prio.suivant.echeance)})`) : null),
      h('td', { 'data-label': 'Échéance' }, d ? h('time', { datetime: d.echeance, title: dateLongue(d.echeance) }, dateCourte(d.echeance)) : '—'),
      h('td', { 'data-label': 'Jours restants' }, badge(niv, prio ? prio.jours : null)));
  };

  const recherche = h('input', { type: 'search', id: 'filtre', placeholder: 'Filtrer : nom, partie, juridiction, référence…', oninput: (e) => { filtre = e.target.value; rendre(); } });
  const cases = h('label', { class: 'case' }, h('input', { type: 'checkbox', onchange: (e) => { voirCloturees = e.target.checked; rendre(); } }), ' Afficher les affaires clôturées');

  rendre();

  const sauvegarde = etat.parametres.derniereSauvegarde;
  const rappel = !sauvegarde || ecartJours(sauvegarde.slice(0, 10), aujourdhui) > 7
    ? h('p', { class: 'rappel-sauvegarde', role: 'note' }, h('span', { 'aria-hidden': 'true' }, '💾 '),
      sauvegarde ? `Dernière sauvegarde le ${dateCourte(sauvegarde.slice(0, 10))}. ` : 'Aucune sauvegarde exportée. ',
      'Les données ne sont conservées que dans ce navigateur : ', h('a', { href: '#/parametres' }, 'exporter une sauvegarde'), '.')
    : null;

  return h('section', { class: 'vue vue-tableau', 'aria-labelledby': 'titre-tableau' },
    h('div', { class: 'entete-vue' },
      h('div', {}, h('h1', { id: 'titre-tableau' }, 'Affaires en cours'), h('p', { class: 'discret' }, `Au ${dateLongue(aujourdhui)} · seuils : rouge ≤ ${seuils.rouge} j, orange ≤ ${seuils.orange} j`)),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-principal', href: '#/nouvelle' }, '+ Nouvelle affaire'),
        h('a', { class: 'btn', href: '#/parametres' }, '⚙ Paramètres'))),
    bandeauAvertissement(),
    rappel,
    compteurs,
    h('div', { class: 'barre-filtre' }, h('label', { for: 'filtre', class: 'visually-hidden' }, 'Filtrer les affaires'), recherche, cases),
    corps,
    h('div', { class: 'legende discret' }, h('span', {}, 'Légende :'), badge('expire', -1), badge('rouge', 1), badge('orange', 5), badge('normal', 20)),
    h('p', { class: 'discret' }, 'Les affaires sont triées de l\'échéance la plus proche à la plus lointaine ; un délai expiré non marqué comme accompli reste en tête.'));
}

function compteur(niv, n, texte) {
  return h('div', { class: `compteur compteur-${niv}` }, h('span', { class: 'compteur-nombre' }, String(n)), ' ', texte);
}
