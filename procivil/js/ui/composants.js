// Composants d'interface réutilisés par plusieurs vues.
import { h, vider, select } from './dom.js';
import { NIVEAUX, libelleEcheance } from '../lib/alertes.js';
import { formatLong, formatCourt } from '../lib/dates.js';
import { chercherCommunes } from '../lib/competence.js';
import { libelleDuree } from '../lib/delais.js';

export function enTete(titre, ...actions) {
  return h('div', { class: 'entete-vue' }, h('h1', {}, titre), actions.length ? h('div', { class: 'actions' }, actions) : null);
}

export function lienRetour(href = '#/', texte = 'Tableau de bord') {
  return h('a', { href, class: 'lien-retour' }, '← ', texte);
}

// Pastille d'urgence : icône + libellé + couleur (jamais la couleur seule).
export function badge(niveau, jours) {
  const n = NIVEAUX[niveau];
  const texte = niveau === 'accompli' ? 'Accompli' : libelleEcheance(jours);
  return h('span', { class: `badge badge-${niveau}` },
    h('span', { class: 'badge-icone', 'aria-hidden': 'true' }, n.icone),
    h('span', { class: 'visually-hidden' }, `${n.titre} : `),
    texte);
}

export function bandeauAvertissement() {
  return h('p', { class: 'bandeau-avertissement', role: 'note' },
    h('strong', {}, 'Outil d\'aide : '),
    'les calculs ne remplacent pas la vérification par le professionnel des textes en vigueur, du point de départ exact et des circonstances de l\'espèce.');
}

export function detailCalcul(calcul) {
  if (!calcul) return h('p', {}, 'Aucun détail de calcul disponible.');
  return h('div', { class: 'detail-calcul' },
    h('dl', { class: 'grille-infos' },
      h('dt', {}, 'Délai'), h('dd', {}, calcul.libelle),
      h('dt', {}, 'Durée'), h('dd', {}, `${libelleDuree(calcul.duree)}${calcul.sens === 'avant' ? ' (à rebours)' : ''}${calcul.distance?.mois ? ` + ${calcul.distance.mois} mois (distance)` : ''}`),
      h('dt', {}, 'Fondement'), h('dd', {}, calcul.article),
      h('dt', {}, 'Sanction'), h('dd', {}, calcul.sanction || '—'),
      h('dt', {}, 'Échéance'), h('dd', {}, h('strong', {}, `${formatLong(calcul.echeance)} à 24 h`))),
    h('h4', {}, 'Calcul pas à pas'),
    h('ol', { class: 'etapes' }, calcul.etapes.map((e) => h('li', {}, h('span', { class: 'etape-article' }, e.article), ' ', e.texte))),
    calcul.avertissements.length ? h('div', { class: 'avertissements', role: 'note' },
      h('h4', {}, h('span', { 'aria-hidden': 'true' }, '⚠️ '), 'Points de vigilance'),
      h('ul', {}, calcul.avertissements.map((a) => h('li', {}, a)))) : null,
    !calcul.verifie ? h('p', { class: 'a-verifier' }, h('span', { 'aria-hidden': 'true' }, '🔎 '), 'Règle marquée « à vérifier » dans le catalogue : contrôlez le texte en vigueur sur Légifrance.') : null);
}

export function selectTypeDelai(catalogue, valeur, attrs = {}) {
  const groupes = catalogue.categories.map((c) => ({
    groupe: c.libelle,
    options: catalogue.delais.filter((d) => d.categorie === c.id).map((d) => ({ value: d.id, label: `${d.libelle} — ${libelleDuree(d.duree)}${d.verifie === false ? ' (à vérifier)' : ''}` })),
  })).filter((g) => g.options.length);
  return select(groupes, valeur, attrs);
}

export function selectTypeActe(catalogue, valeur, attrs = {}) {
  return select(catalogue.actes.map((a) => ({ value: a.id, label: a.libelle })), valeur, attrs);
}

export function selectResidence(distance, valeur, attrs = {}) {
  return select(distance.residences.map((r) => ({ value: r.id, label: r.libelle })), valeur || 'metropole', attrs);
}

export function selectLieuJuridiction(distance, valeur, attrs = {}) {
  const opts = [{ value: 'metropole', label: 'Juridiction en métropole' }]
    .concat(distance.residences.filter((r) => r.outremer && !r.seulement643).map((r) => ({ value: r.id, label: `Juridiction à ${r.libelle}` })));
  return select(opts, valeur || 'metropole', attrs);
}

export function selectZoneFeries(feries, valeur, attrs = {}) {
  return select(Object.entries(feries.zones).map(([id, z]) => ({ value: id, label: z.libelle })), valeur || 'metropole', attrs);
}

// Champ de recherche de commune avec liste de suggestions accessible.
export function champCommune(app, { id, label, aide, valeur, onChoix }) {
  const input = h('input', { type: 'text', id, autocomplete: 'off', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': `${id}-liste`, 'aria-autocomplete': 'list', placeholder: 'Nom de la commune ou code postal', value: valeur ? `${valeur.nom} (${valeur.dep})` : '' });
  const liste = h('ul', { id: `${id}-liste`, role: 'listbox', class: 'suggestions', hidden: true });
  let resultats = [];
  let actif = -1;
  const fermer = () => { liste.hidden = true; input.setAttribute('aria-expanded', 'false'); actif = -1; };
  const choisir = (c) => { input.value = `${c.nom} (${c.dep})`; fermer(); onChoix(c); };
  const afficher = () => {
    vider(liste, ...resultats.map((c, i) => h('li', {
      role: 'option', id: `${id}-opt-${i}`, 'aria-selected': i === actif ? 'true' : 'false',
      onmousedown: (e) => { e.preventDefault(); choisir(c); },
    }, `${c.nom} `, h('span', { class: 'discret' }, `${c.cp} · dép. ${c.dep}`))));
    liste.hidden = !resultats.length;
    input.setAttribute('aria-expanded', String(!!resultats.length));
    if (actif >= 0) input.setAttribute('aria-activedescendant', `${id}-opt-${actif}`); else input.removeAttribute('aria-activedescendant');
  };
  input.addEventListener('input', async () => {
    const { index } = await app.chargerCommunes();
    resultats = chercherCommunes(index, input.value);
    actif = -1; afficher();
  });
  input.addEventListener('keydown', (e) => {
    if (liste.hidden) return;
    if (e.key === 'ArrowDown') { actif = Math.min(actif + 1, resultats.length - 1); afficher(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { actif = Math.max(actif - 1, 0); afficher(); e.preventDefault(); }
    if (e.key === 'Enter' && actif >= 0) { choisir(resultats[actif]); e.preventDefault(); }
    if (e.key === 'Escape') fermer();
  });
  input.addEventListener('blur', () => setTimeout(fermer, 150));
  return h('div', { class: 'champ champ-commune' }, h('label', { for: id }, label), h('div', { class: 'combo' }, input, liste), aide ? h('p', { class: 'aide' }, aide) : null);
}

export const dateCourte = formatCourt;
export const dateLongue = formatLong;
