// Page 2 : fiche détaillée d'une affaire, avec frise chronologique.
import { h, vider, champ, select, dialogue, confirmer, annoncer, telecharger } from './dom.js';
import {
  badge, bandeauAvertissement, detailCalcul, lienRetour, selectTypeActe, selectTypeDelai,
  selectResidence, selectLieuJuridiction, selectZoneFeries, dateCourte, dateLongue,
} from './composants.js';
import {
  ajouterActe, ajouterDelai, modifierActe, supprimerActe, basculerAccompli, evenementsFrise, recalculerAffaire,
} from '../model.js';
import { seuilsAffaire, validerSeuils, joursRestants, niveau } from '../lib/alertes.js';
import { estDateISO } from '../lib/dates.js';
import { trouverType, libelleDuree } from '../lib/delais.js';
import { genererICS } from '../lib/ics.js';

export function vueFiche(app, id) {
  const affaire = app.affaire(id);
  if (!affaire) throw new Error('Affaire introuvable (supprimée ou identifiant erroné).');
  const racine = h('section', { class: 'vue vue-fiche' });
  const rendre = () => vider(racine, ...contenu(app, affaire, rendre));
  rendre();
  return racine;
}

function contenu(app, a, rendre) {
  const { regles, aujourdhui } = app;
  const seuils = seuilsAffaire(a, app.etat.parametres.seuils);
  const sauver = async (msg) => { await app.sauver(msg); rendre(); };
  const zoneLib = regles.feries.zones[a.contexte.zoneFeries]?.libelle || 'Métropole';
  const lieuLib = a.contexte.lieuJuridiction === 'metropole' ? 'Métropole' : regles.distance.residences.find((r) => r.id === a.contexte.lieuJuridiction)?.libelle;
  const residLib = regles.distance.residences.find((r) => r.id === a.contexte.residence)?.libelle || 'France métropolitaine';

  const detail = h('div', { class: 'detail-etape', id: 'detail-etape', 'aria-live': 'polite', tabindex: '-1' },
    h('p', { class: 'discret' }, 'Cliquez sur une étape de la frise pour afficher le détail du calcul.'));

  const montrerDelai = (d) => {
    vider(detail, 
      h('h3', {}, d.libelle),
      d.statut === 'accompli' ? h('p', {}, badge('accompli'), ` le ${dateCourte(d.accompliLe || d.echeance)}`) : null,
      detailCalcul(d.calcul),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: async () => { basculerAccompli(a, d.id, aujourdhui); await sauver(d.statut === 'accompli' ? 'Délai marqué comme accompli.' : 'Délai rouvert.'); } }, d.statut === 'accompli' ? 'Marquer comme à faire' : '✔ Marquer comme accompli'),
        h('button', { class: 'btn', type: 'button', onclick: () => editerDelai(app, a, d, sauver) }, 'Modifier les paramètres')));
    detail.focus();
  };
  const montrerActe = (acte) => {
    const lies = a.delais.filter((d) => d.acteId === acte.id);
    vider(detail, 
      h('h3', {}, acte.libelle),
      h('p', {}, `${dateLongue(acte.date)} · ${regles.catalogue.actes.find((x) => x.id === acte.type)?.libelle || 'Acte'}`),
      acte.commentaire ? h('p', {}, acte.commentaire) : null,
      acte.source === 'document' ? h('p', { class: 'discret' }, `Créé à partir du document « ${acte.document?.nom || ''} » (informations validées par l'utilisateur).`) : null,
      h('p', {}, lies.length ? `Délais qui en découlent : ${lies.map((d) => d.libelle).join(' ; ')}.` : 'Aucun délai rattaché.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => editerActe(app, a, acte, sauver) }, 'Modifier la date ou le libellé'),
        h('button', { class: 'btn', type: 'button', onclick: () => formulaireDelai(app, a, sauver, acte) }, '+ Rattacher un délai')));
    detail.focus();
  };

  return [
    lienRetour(),
    h('div', { class: 'entete-vue' },
      h('div', {},
        h('h1', {}, a.nom, a.statut === 'cloturee' ? h('span', { class: 'etiquette' }, 'Clôturée') : null),
        h('p', { class: 'discret' }, [a.reference && `Réf. cabinet ${a.reference}`, a.rg && `RG ${a.rg}`, a.demo && 'Affaire fictive de démonstration'].filter(Boolean).join(' · '))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => editerAffaire(app, a, sauver) }, 'Modifier l\'affaire'),
        h('a', { class: 'btn', href: `#/document/${a.id}` }, '📄 Déposer un document'),
        h('a', { class: 'btn', href: `#/competence/${a.id}` }, '⚖ Compétence'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          telecharger(new Blob([genererICS([a])], { type: 'text/calendar' }), `echeances-${a.reference || a.id}.ics`);
        } }, '📅 Export agenda'))),
    bandeauAvertissement(),

    h('div', { class: 'grille-2' },
      h('div', { class: 'carte' },
        h('h2', {}, 'Parties et juridiction'),
        h('dl', { class: 'grille-infos' },
          h('dt', {}, 'Demandeur'), h('dd', {}, a.parties.demandeur || '—', a.client === 'demandeur' ? h('span', { class: 'etiquette' }, 'client') : null),
          h('dt', {}, 'Défendeur'), h('dd', {}, a.parties.defendeur || '—', a.client === 'defendeur' ? h('span', { class: 'etiquette' }, 'client') : null),
          h('dt', {}, 'Juridiction'), h('dd', {}, a.juridiction?.nomPrecis || a.juridiction?.libelle || 'Non renseignée',
            a.juridiction?.fondements?.length ? h('div', { class: 'discret' }, a.juridiction.fondements.map((f) => f.article).join(' ; ')) : null,
            h('div', {}, h('a', { href: `#/competence/${a.id}` }, a.juridiction?.libelle ? 'Revoir la compétence' : 'Déterminer la juridiction compétente'))))),
      h('div', { class: 'carte' },
        h('h2', {}, 'Paramètres de calcul'),
        h('dl', { class: 'grille-infos' },
          h('dt', {}, 'Siège de la juridiction'), h('dd', {}, lieuLib),
          h('dt', {}, 'Jours fériés appliqués'), h('dd', {}, zoneLib),
          h('dt', {}, 'Résidence de la partie'), h('dd', {}, residLib, h('div', { class: 'discret' }, 'Sert aux délais de distance (art. 643 et 644 CPC)')),
          h('dt', {}, 'Seuils d\'alerte'), h('dd', {}, `rouge ≤ ${seuils.rouge} j, orange ≤ ${seuils.orange} j`, a.seuils ? h('span', { class: 'etiquette' }, 'propres à l\'affaire') : h('span', { class: 'discret' }, ' (paramètres généraux)'))))),

    h('div', { class: 'carte' },
      h('div', { class: 'entete-carte' }, h('h2', {}, 'Frise chronologique'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn-principal', type: 'button', onclick: () => formulaireActe(app, a, sauver) }, '+ Ajouter un acte'),
          h('button', { class: 'btn', type: 'button', onclick: () => formulaireDelai(app, a, sauver) }, '+ Ajouter un délai'))),
      frise(evenementsFrise(a, aujourdhui, seuils), aujourdhui, montrerActe, montrerDelai),
      detail),

    h('div', { class: 'carte' },
      h('h2', {}, 'Délais'),
      a.delais.length ? h('table', { class: 'table-simple' },
        h('thead', {}, h('tr', {}, ['Délai', 'Départ', 'Échéance', 'État', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, [...a.delais].sort((x, y) => (x.echeance < y.echeance ? -1 : 1)).map((d) => {
          const j = joursRestants(d.echeance, aujourdhui);
          const niv = d.statut === 'accompli' ? 'accompli' : niveau(j, seuils);
          return h('tr', { class: `niveau-${niv}` },
            h('td', { 'data-label': 'Délai' }, d.libelle, h('div', { class: 'discret' }, `${d.article}${d.calcul?.verifie === false ? ' · à vérifier' : ''}`)),
            h('td', { 'data-label': 'Départ' }, d.dateDepart ? dateCourte(d.dateDepart) : '—'),
            h('td', { 'data-label': 'Échéance' }, h('time', { datetime: d.echeance }, dateCourte(d.echeance))),
            h('td', { 'data-label': 'État' }, badge(niv, j)),
            h('td', { class: 'cellule-actions' },
              h('button', { class: 'btn btn-petit', type: 'button', onclick: () => montrerDelai(d) }, 'Détail'),
              h('button', { class: 'btn btn-petit', type: 'button', onclick: async () => { basculerAccompli(a, d.id, aujourdhui); await sauver(); } }, d.statut === 'accompli' ? 'Rouvrir' : '✔ Accompli'),
              h('button', { class: 'btn btn-petit btn-lien-danger', type: 'button', 'aria-label': `Supprimer le délai ${d.libelle}`, onclick: async () => {
                if (await confirmer('Supprimer ce délai ?', `« ${d.libelle} » sera retiré de l'affaire.`, 'Supprimer')) { a.delais = a.delais.filter((x) => x.id !== d.id); await sauver('Délai supprimé.'); }
              } }, 'Supprimer')));
        }))) : h('p', { class: 'discret' }, 'Aucun délai. Ajoutez un acte (signification, assignation…) pour obtenir les délais qui en découlent.')),

    h('div', { class: 'carte' },
      h('h2', {}, 'Actes et événements'),
      a.actes.length ? h('table', { class: 'table-simple' },
        h('thead', {}, h('tr', {}, ['Date', 'Acte', 'Délais liés', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, a.actes.map((acte) => h('tr', {},
          h('td', { 'data-label': 'Date' }, dateCourte(acte.date)),
          h('td', { 'data-label': 'Acte' }, acte.libelle, acte.source === 'document' ? h('span', { class: 'etiquette' }, 'document') : null),
          h('td', { 'data-label': 'Délais liés' }, String(a.delais.filter((d) => d.acteId === acte.id).length)),
          h('td', { class: 'cellule-actions' },
            h('button', { class: 'btn btn-petit', type: 'button', onclick: () => editerActe(app, a, acte, sauver) }, 'Modifier'),
            h('button', { class: 'btn btn-petit btn-lien-danger', type: 'button', onclick: async () => {
              const n = a.delais.filter((d) => d.acteId === acte.id).length;
              if (await confirmer('Supprimer cet acte ?', `« ${acte.libelle} »${n ? ` et les ${n} délai(s) qui en découlent` : ''} seront supprimés.`, 'Supprimer')) { supprimerActe(a, acte.id); await sauver('Acte supprimé.'); }
            } }, 'Supprimer')))))) : h('p', { class: 'discret' }, 'Aucun acte enregistré.')),

    h('div', { class: 'carte' },
      h('h2', {}, h('label', { for: 'notes' }, 'Notes')),
      h('textarea', { id: 'notes', rows: '4', onchange: async (e) => { a.notes = e.target.value; await app.sauver('Notes enregistrées.'); } }, a.notes || '')),

    h('div', { class: 'actions actions-bas' },
      h('button', { class: 'btn', type: 'button', onclick: async () => { a.statut = a.statut === 'cloturee' ? 'en_cours' : 'cloturee'; await sauver(a.statut === 'cloturee' ? 'Affaire clôturée.' : 'Affaire rouverte.'); } }, a.statut === 'cloturee' ? 'Rouvrir l\'affaire' : 'Clôturer l\'affaire'),
      h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => {
        if (await confirmer('Supprimer définitivement l\'affaire ?', `« ${a.nom} », ses actes et ses délais seront supprimés de ce navigateur. Exportez une sauvegarde avant si nécessaire.`, 'Supprimer')) {
          app.etat.affaires = app.etat.affaires.filter((x) => x.id !== a.id); await app.sauver('Affaire supprimée.'); app.aller('#/');
        }
      } }, 'Supprimer l\'affaire')),
  ];
}

// --- Frise : horizontale sur grand écran, verticale sur mobile (CSS) ---
function frise(items, aujourdhui, surActe, surDelai) {
  if (items.length <= 1) return h('p', { class: 'discret' }, 'La frise se remplira à mesure que vous ajouterez des actes et des délais.');
  return h('ol', { class: 'frise', 'aria-label': 'Frise chronologique de l\'affaire' }, items.map((it) => {
    if (it.genre === 'aujourdhui') {
      return h('li', { class: 'frise-item frise-aujourdhui', 'aria-current': 'date' },
        h('span', { class: 'frise-point', 'aria-hidden': 'true' }),
        h('div', { class: 'frise-carte' }, h('strong', {}, 'Aujourd\'hui'), h('time', { datetime: aujourdhui }, dateCourte(aujourdhui))));
    }
    if (it.genre === 'acte') {
      return h('li', { class: `frise-item frise-acte ${it.passe ? 'passe' : 'futur'}` },
        h('span', { class: 'frise-point', 'aria-hidden': 'true' }),
        h('button', { type: 'button', class: 'frise-carte', onclick: () => surActe(it.acte), 'aria-controls': 'detail-etape' },
          h('span', { class: 'frise-type' }, 'Acte'),
          h('time', { datetime: it.date }, dateCourte(it.date)),
          h('span', { class: 'frise-titre' }, it.acte.libelle)));
    }
    const d = it.delai;
    return h('li', { class: `frise-item frise-delai niveau-${it.niveau}` },
      h('span', { class: 'frise-point', 'aria-hidden': 'true' }),
      h('button', { type: 'button', class: 'frise-carte', onclick: () => surDelai(d), 'aria-controls': 'detail-etape' },
        h('span', { class: 'frise-type' }, 'Échéance'),
        h('time', { datetime: it.date }, dateCourte(it.date)),
        h('span', { class: 'frise-titre' }, d.libelle),
        h('span', { class: 'frise-meta' }, `${libelleDuree(d.calcul?.duree)}${d.calcul?.distance?.mois ? ` + ${d.calcul.distance.mois} mois` : ''} · ${d.article}`),
        badge(it.niveau, it.jours)));
  }));
}

// --- Formulaires (boîtes de dialogue) ---

function formulaireActe(app, a, sauver) {
  const { regles } = app;
  const type = selectTypeActe(regles.catalogue, 'signification_jugement', { id: 'f-type-acte' });
  const libelle = h('input', { type: 'text', id: 'f-libelle-acte', value: '' });
  const date = h('input', { type: 'date', id: 'f-date-acte', value: app.aujourdhui, max: '2100-12-31' });
  const resid = selectResidence(regles.distance, a.contexte.residence, { id: 'f-resid-acte' });
  const surPlace = h('input', { type: 'checkbox', id: 'f-surplace' });
  const zoneSugg = h('fieldset', { class: 'suggestions-delais' });
  const erreur = h('p', { class: 'erreur', role: 'alert', hidden: true });

  const majSuggestions = () => {
    const def = regles.catalogue.actes.find((x) => x.id === type.value);
    if (!libelle.value || libelle.dataset.auto) { libelle.value = def.libelle; libelle.dataset.auto = '1'; }
    vider(zoneSugg, h('legend', {}, 'Délais qui découlent de cet acte'),
      def.suggestions.length ? def.suggestions.map((sid) => {
        const t = trouverType(regles.catalogue, sid);
        return h('label', { class: 'case' }, h('input', { type: 'checkbox', value: sid, checked: def.suggestions[0] === sid }), ` ${t.libelle} — ${libelleDuree(t.duree)} (${t.article})${t.verifie === false ? ' — à vérifier' : ''}`);
      }) : h('p', { class: 'discret' }, 'Aucun délai proposé pour ce type d\'acte. Vous pourrez en ajouter un manuellement.'));
  };
  type.addEventListener('change', majSuggestions);
  libelle.addEventListener('input', () => { delete libelle.dataset.auto; });
  majSuggestions();

  dialogue({
    titre: 'Ajouter un acte',
    contenu: h('div', { class: 'formulaire' },
      champ({ label: 'Nature de l\'acte', id: 'f-type-acte' }, type),
      champ({ label: 'Libellé', id: 'f-libelle-acte' }, libelle),
      champ({ label: 'Date de l\'acte ou de l\'événement', id: 'f-date-acte', requis: true, aide: 'Pour une notification par lettre recommandée, retenez la date de réception (art. 668 CPC). Le jour de l\'acte ne compte pas dans le délai (art. 641).' }, date),
      zoneSugg,
      champ({ label: 'Résidence de la partie qui doit agir', id: 'f-resid-acte', aide: 'Délais de distance (art. 643 et 644 CPC).' }, resid),
      h('label', { class: 'case' }, surPlace, ' Acte remis à la personne dans un lieu où elle ne bénéficie pas du délai de distance (art. 647)'),
      erreur),
    boutons: [{ label: 'Annuler', valeur: null }, { label: 'Enregistrer', valeur: () => {
      if (!estDateISO(date.value)) { erreur.hidden = false; erreur.textContent = 'Indiquez une date valide.'; return undefined; }
      const acte = ajouterActe(a, { type: type.value, libelle: libelle.value.trim() || 'Acte', date: date.value });
      const coches = [...zoneSugg.querySelectorAll('input:checked')].map((i) => i.value);
      for (const typeId of coches) ajouterDelai(a, { typeId, acteId: acte.id, residence: resid.value !== a.contexte.residence ? resid.value : null, notifieSurPlace: surPlace.checked }, regles, app.joursChomes());
      return { n: coches.length };
    } }],
  }).then(async (r) => { if (r) await sauver(`Acte ajouté${r.n ? ` et ${r.n} délai(s) calculé(s)` : ''}.`); });
}

function formulaireDelai(app, a, sauver, acteInitial) {
  const { regles } = app;
  const type = selectTypeDelai(regles.catalogue, 'appel_contentieux', { id: 'f-type-delai' });
  const actes = select([{ value: '', label: '— Date libre (sans acte enregistré) —' }, ...a.actes.map((x) => ({ value: x.id, label: `${dateCourte(x.date)} — ${x.libelle}` }))], acteInitial?.id || a.actes[a.actes.length - 1]?.id || '', { id: 'f-acte-delai' });
  const date = h('input', { type: 'date', id: 'f-date-delai', value: app.aujourdhui });
  const resid = selectResidence(regles.distance, a.contexte.residence, { id: 'f-resid-delai' });
  const libre = h('div', { class: 'bloc-libre' });
  const erreur = h('p', { class: 'erreur', role: 'alert', hidden: true });
  const mois = h('input', { type: 'number', min: '0', id: 'f-mois', value: '0' });
  const jours = h('input', { type: 'number', min: '0', id: 'f-jours', value: '15' });
  const sens = select([{ value: 'apres', label: 'Après l\'événement' }, { value: 'avant', label: 'Avant l\'événement (à rebours)' }], 'apres', { id: 'f-sens' });
  const dateImposee = h('input', { type: 'date', id: 'f-date-imposee' });
  const majType = () => {
    const t = trouverType(regles.catalogue, type.value);
    vider(libre, ...(t.personnalise ? [
      h('div', { class: 'grille-3' }, champ({ label: 'Mois', id: 'f-mois' }, mois), champ({ label: 'Jours', id: 'f-jours' }, jours), champ({ label: 'Sens', id: 'f-sens' }, sens)),
      champ({ label: 'Ou date imposée (calendrier de procédure, ordonnance)', id: 'f-date-imposee' }, dateImposee),
    ] : [h('p', { class: 'discret' }, `${libelleDuree(t.duree)} à compter de : ${t.depart}. ${t.article}.`)]));
  };
  const majActe = () => { date.disabled = !!actes.value; };
  type.addEventListener('change', majType); actes.addEventListener('change', majActe);
  majType(); majActe();

  dialogue({
    titre: 'Ajouter un délai',
    contenu: h('div', { class: 'formulaire' },
      champ({ label: 'Type de délai', id: 'f-type-delai' }, type), libre,
      champ({ label: 'Acte qui fait courir le délai', id: 'f-acte-delai' }, actes),
      champ({ label: 'Date de départ (si aucun acte)', id: 'f-date-delai' }, date),
      champ({ label: 'Résidence de la partie qui doit agir', id: 'f-resid-delai' }, resid), erreur),
    boutons: [{ label: 'Annuler', valeur: null }, { label: 'Calculer et ajouter', valeur: () => {
      try {
        const t = trouverType(regles.catalogue, type.value);
        const opts = { typeId: type.value, acteId: actes.value || null, dateDepart: actes.value ? null : date.value, residence: resid.value !== a.contexte.residence ? resid.value : null };
        if (t.personnalise) Object.assign(opts, { duree: { mois: Number(mois.value) || 0, jours: Number(jours.value) || 0 }, sens: sens.value, dateImposee: dateImposee.value || null, dateDepart: opts.dateDepart || dateImposee.value || null });
        return ajouterDelai(a, opts, regles, app.joursChomes());
      } catch (e) { erreur.hidden = false; erreur.textContent = e.message; return undefined; }
    } }],
  }).then(async (d) => { if (d) await sauver(`Délai ajouté : échéance le ${dateLongue(d.echeance)}.`); });
}

function editerDelai(app, a, d, sauver) {
  const { regles } = app;
  const resid = selectResidence(regles.distance, d.residence || a.contexte.residence, { id: 'e-resid' });
  const surPlace = h('input', { type: 'checkbox', id: 'e-surplace', checked: d.notifieSurPlace });
  const ajDemande = h('input', { type: 'date', id: 'e-aj-demande', value: d.interruption?.dateDemande || '' });
  const ajDepart = h('input', { type: 'date', id: 'e-aj-depart', value: d.interruption?.dateNouveauDepart || '' });
  dialogue({
    titre: `Paramètres : ${d.libelle}`,
    contenu: h('div', { class: 'formulaire' },
      champ({ label: 'Résidence de la partie qui doit agir', id: 'e-resid' }, resid),
      h('label', { class: 'case' }, surPlace, ' Remis à la personne dans un lieu sans délai de distance (art. 647)'),
      h('fieldset', {}, h('legend', {}, 'Interruption (aide juridictionnelle)'),
        h('p', { class: 'aide' }, 'Art. 43 du décret n° 2020-1717 : la demande d\'aide juridictionnelle formée avant l\'expiration du délai l\'interrompt ; un nouveau délai complet court ensuite. Vérifiez le point de départ exact.'),
        champ({ label: 'Date de la demande d\'aide', id: 'e-aj-demande' }, ajDemande),
        champ({ label: 'Point de départ du nouveau délai', id: 'e-aj-depart' }, ajDepart))),
    boutons: [{ label: 'Annuler', valeur: null }, { label: 'Recalculer', valeur: true }],
  }).then(async (ok) => {
    if (!ok) return;
    d.residence = resid.value !== a.contexte.residence ? resid.value : null; d.notifieSurPlace = surPlace.checked;
    d.interruption = ajDepart.value ? { dateDemande: ajDemande.value || null, dateNouveauDepart: ajDepart.value, motif: 'aide juridictionnelle' } : null;
    const avant = d.echeance;
    recalculerAffaire(a, regles, app.joursChomes());
    const apres = a.delais.find((x) => x.id === d.id).echeance;
    await sauver(avant === apres ? 'Paramètres enregistrés (échéance inchangée).' : `Échéance recalculée : ${dateCourte(avant)} → ${dateCourte(apres)}.`);
  });
}

function editerActe(app, a, acte, sauver) {
  const date = h('input', { type: 'date', id: 'm-date', value: acte.date });
  const libelle = h('input', { type: 'text', id: 'm-libelle', value: acte.libelle });
  const comm = h('textarea', { id: 'm-comm', rows: '2' }, acte.commentaire || '');
  dialogue({
    titre: 'Modifier l\'acte',
    contenu: h('div', { class: 'formulaire' },
      champ({ label: 'Libellé', id: 'm-libelle' }, libelle),
      champ({ label: 'Date', id: 'm-date', aide: 'Les délais rattachés à cet acte seront recalculés.' }, date),
      champ({ label: 'Commentaire', id: 'm-comm' }, comm)),
    boutons: [{ label: 'Annuler', valeur: null }, { label: 'Enregistrer et recalculer', valeur: () => (estDateISO(date.value) ? true : undefined) }],
  }).then(async (ok) => {
    if (!ok) return;
    const diffs = modifierActe(a, acte.id, { date: date.value, libelle: libelle.value.trim() || acte.libelle, commentaire: comm.value }, app.regles, app.joursChomes());
    const changes = diffs.filter((x) => x.avant !== x.apres);
    await sauver(changes.length ? `Délais recalculés : ${changes.map((x) => `${x.libelle} ${dateCourte(x.avant)} → ${dateCourte(x.apres)}`).join(' ; ')}` : 'Acte modifié.');
  });
}

function editerAffaire(app, a, sauver) {
  const { regles } = app;
  const f = {
    nom: h('input', { type: 'text', id: 'a-nom', value: a.nom }),
    reference: h('input', { type: 'text', id: 'a-ref', value: a.reference }),
    rg: h('input', { type: 'text', id: 'a-rg', value: a.rg }),
    demandeur: h('input', { type: 'text', id: 'a-dem', value: a.parties.demandeur }),
    defendeur: h('input', { type: 'text', id: 'a-def', value: a.parties.defendeur }),
    client: select([{ value: 'demandeur', label: 'Demandeur' }, { value: 'defendeur', label: 'Défendeur' }], a.client, { id: 'a-client' }),
    juridiction: h('input', { type: 'text', id: 'a-jur', value: a.juridiction?.nomPrecis || a.juridiction?.libelle || '' }),
    lieu: selectLieuJuridiction(regles.distance, a.contexte.lieuJuridiction, { id: 'a-lieu' }),
    zone: selectZoneFeries(regles.feries, a.contexte.zoneFeries, { id: 'a-zone' }),
    residence: selectResidence(regles.distance, a.contexte.residence, { id: 'a-resid' }),
    seuilsPropres: h('input', { type: 'checkbox', id: 'a-seuils', checked: !!a.seuils }),
    rouge: h('input', { type: 'number', id: 'a-rouge', min: '0', value: a.seuils?.rouge ?? app.etat.parametres.seuils.rouge }),
    orange: h('input', { type: 'number', id: 'a-orange', min: '1', value: a.seuils?.orange ?? app.etat.parametres.seuils.orange }),
  };
  const erreur = h('div', { class: 'erreur', role: 'alert', hidden: true });
  dialogue({
    titre: 'Modifier l\'affaire',
    contenu: h('div', { class: 'formulaire' },
      champ({ label: 'Nom de l\'affaire', id: 'a-nom', requis: true }, f.nom),
      h('div', { class: 'grille-2' }, champ({ label: 'Référence cabinet', id: 'a-ref' }, f.reference), champ({ label: 'Numéro RG', id: 'a-rg' }, f.rg)),
      h('div', { class: 'grille-2' }, champ({ label: 'Demandeur', id: 'a-dem' }, f.demandeur), champ({ label: 'Défendeur', id: 'a-def' }, f.defendeur)),
      champ({ label: 'Votre client est', id: 'a-client' }, f.client),
      champ({ label: 'Juridiction saisie', id: 'a-jur' }, f.juridiction),
      champ({ label: 'Siège de la juridiction', id: 'a-lieu' }, f.lieu),
      champ({ label: 'Jours fériés à appliquer', id: 'a-zone', aide: 'Ceux du lieu où l\'acte doit être accompli (en principe la juridiction).' }, f.zone),
      champ({ label: 'Résidence de la partie (délais de distance)', id: 'a-resid' }, f.residence),
      h('fieldset', {}, h('legend', {}, 'Seuils d\'alerte'),
        h('label', { class: 'case' }, f.seuilsPropres, ' Utiliser des seuils propres à cette affaire'),
        h('div', { class: 'grille-2' }, champ({ label: 'Seuil rouge (jours)', id: 'a-rouge' }, f.rouge), champ({ label: 'Seuil orange (jours)', id: 'a-orange' }, f.orange))),
      erreur),
    boutons: [{ label: 'Annuler', valeur: null }, { label: 'Enregistrer', valeur: () => {
      if (f.seuilsPropres.checked) {
        const v = validerSeuils(f.rouge.value === '' ? '' : Number(f.rouge.value), f.orange.value === '' ? '' : Number(f.orange.value));
        if (!v.ok) { erreur.hidden = false; vider(erreur, ...v.erreurs.map((e) => h('p', {}, e))); return undefined; }
        return v.valeurs;
      }
      return 'global';
    } }],
  }).then(async (r) => {
    if (!r) return;
    Object.assign(a, { nom: f.nom.value.trim() || a.nom, reference: f.reference.value, rg: f.rg.value, client: f.client.value });
    a.parties = { demandeur: f.demandeur.value, defendeur: f.defendeur.value };
    if ((a.juridiction?.nomPrecis || a.juridiction?.libelle || '') !== f.juridiction.value) a.juridiction = { ...(a.juridiction || {}), nomPrecis: f.juridiction.value, libelle: a.juridiction?.libelle || f.juridiction.value };
    a.contexte = { lieuJuridiction: f.lieu.value, zoneFeries: f.zone.value, residence: f.residence.value };
    a.seuils = r === 'global' ? null : r;
    recalculerAffaire(a, regles, app.joursChomes());
    await sauver('Affaire modifiée ; délais recalculés.');
  });
}

