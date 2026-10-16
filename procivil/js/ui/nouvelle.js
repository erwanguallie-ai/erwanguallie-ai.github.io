// Création d'une affaire : saisie manuelle ou dépôt d'un document.
import { h, champ, select, annoncer } from './dom.js';
import { lienRetour, selectLieuJuridiction, selectZoneFeries, selectResidence, champCommune, bandeauAvertissement } from './composants.js';
import { creerAffaire } from '../model.js';

export function vueNouvelle(app) {
  const { regles } = app;
  const f = {
    nom: h('input', { type: 'text', id: 'n-nom', required: true, placeholder: 'Ex. : Martin c/ Société X' }),
    reference: h('input', { type: 'text', id: 'n-ref' }),
    rg: h('input', { type: 'text', id: 'n-rg' }),
    demandeur: h('input', { type: 'text', id: 'n-dem' }),
    defendeur: h('input', { type: 'text', id: 'n-def' }),
    client: select([{ value: 'demandeur', label: 'Demandeur' }, { value: 'defendeur', label: 'Défendeur' }], 'demandeur', { id: 'n-client' }),
    juridiction: h('input', { type: 'text', id: 'n-jur', placeholder: 'Ex. : Tribunal judiciaire de Lyon' }),
    lieu: selectLieuJuridiction(regles.distance, 'metropole', { id: 'n-lieu' }),
    zone: selectZoneFeries(regles.feries, 'metropole', { id: 'n-zone' }),
    residence: selectResidence(regles.distance, 'metropole', { id: 'n-resid' }),
  };
  let commune = null;
  const infoCommune = h('p', { class: 'aide', 'aria-live': 'polite' });
  const auto = (dep) => {
    const zone = app.zoneDepuisDep(dep);
    f.zone.value = zone;
    const resid = regles.distance.departementsVersResidence[dep];
    f.lieu.value = resid && [...f.lieu.options].some((o) => o.value === resid) ? resid : 'metropole';
    infoCommune.textContent = `Jours fériés : ${regles.feries.zones[zone].libelle} · siège : ${f.lieu.selectedOptions[0].textContent}. Vous pouvez corriger ci-dessous.`;
  };

  const creer = async (e) => {
    e.preventDefault();
    if (!f.nom.value.trim()) { annoncer('Le nom de l\'affaire est obligatoire.', 'erreur'); f.nom.focus(); return; }
    const a = creerAffaire({
      nom: f.nom.value, reference: f.reference.value, rg: f.rg.value, demandeur: f.demandeur.value, defendeur: f.defendeur.value,
      client: f.client.value, lieuJuridiction: f.lieu.value, zoneFeries: f.zone.value, residence: f.residence.value,
      juridiction: { libelle: f.juridiction.value, nomPrecis: f.juridiction.value, commune },
    });
    app.etat.affaires.push(a);
    await app.sauver('Affaire créée. Ajoutez maintenant un acte pour calculer les délais.');
    app.aller(`#/affaire/${a.id}`);
  };

  return h('section', { class: 'vue' },
    lienRetour(),
    h('h1', {}, 'Nouvelle affaire'),
    bandeauAvertissement(),
    h('div', { class: 'grille-2 choix-creation' },
      h('a', { class: 'carte carte-choix', href: '#/document' },
        h('span', { class: 'grande-icone', 'aria-hidden': 'true' }, '📄'),
        h('strong', {}, 'À partir d\'un document'),
        h('span', {}, 'Déposez une assignation, une signification ou un jugement (PDF ou photo). Le texte est analysé dans votre navigateur ; vous validez chaque information.')),
      h('a', { class: 'carte carte-choix', href: '#/competence' },
        h('span', { class: 'grande-icone', 'aria-hidden': 'true' }, '⚖'),
        h('strong', {}, 'Déterminer d\'abord la juridiction'),
        h('span', {}, 'Assistant de compétence matérielle et territoriale, en quelques questions.'))),
    h('form', { class: 'carte formulaire', onsubmit: creer, novalidate: true },
      h('h2', {}, 'Saisie manuelle'),
      champ({ label: 'Nom de l\'affaire', id: 'n-nom', requis: true }, f.nom),
      h('div', { class: 'grille-2' }, champ({ label: 'Référence cabinet', id: 'n-ref' }, f.reference), champ({ label: 'Numéro RG', id: 'n-rg' }, f.rg)),
      h('div', { class: 'grille-2' }, champ({ label: 'Demandeur', id: 'n-dem' }, f.demandeur), champ({ label: 'Défendeur', id: 'n-def' }, f.defendeur)),
      champ({ label: 'Votre client est', id: 'n-client' }, f.client),
      champ({ label: 'Juridiction saisie (si connue)', id: 'n-jur' }, f.juridiction),
      champCommune(app, { id: 'n-commune', label: 'Commune du siège de la juridiction', aide: 'Sert à déterminer les jours fériés (Alsace-Moselle, outre-mer) et les délais de distance.', onChoix: (c) => { commune = { insee: c.insee, nom: c.nom, dep: c.dep }; auto(c.dep); } }),
      infoCommune,
      h('div', { class: 'grille-3' },
        champ({ label: 'Siège de la juridiction', id: 'n-lieu' }, f.lieu),
        champ({ label: 'Jours fériés appliqués', id: 'n-zone' }, f.zone),
        champ({ label: 'Résidence de la partie (distance)', id: 'n-resid', aide: 'Celle de la partie qui devra agir dans les délais (art. 643-644).' }, f.residence)),
      h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'btn btn-principal' }, 'Créer l\'affaire'), h('a', { class: 'btn', href: '#/' }, 'Annuler'))));
}
