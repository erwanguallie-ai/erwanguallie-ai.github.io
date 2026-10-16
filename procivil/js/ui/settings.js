// Panneau des paramètres : seuils d'alerte, jours chômés, sauvegarde, chiffrement, IA.
import { h, vider, champ, annoncer, telecharger, confirmer, demanderPhrase, dialogue } from './dom.js';
import { lienRetour, badge, dateCourte } from './composants.js';
import { validerSeuils, SEUILS_DEFAUT, niveau } from '../lib/alertes.js';
import { estDateISO } from '../lib/dates.js';
import { listeFeries } from '../lib/feries.js';
import { recalculerAffaire } from '../model.js';
import * as stockage from '../storage.js';

export function vueParametres(app) {
  const p = app.etat.parametres;
  const racine = h('section', { class: 'vue vue-parametres' });

  // --- Seuils ---
  const rouge = h('input', { type: 'number', id: 's-rouge', min: '0', max: '364', step: '1', inputmode: 'numeric', value: p.seuils.rouge });
  const orange = h('input', { type: 'number', id: 's-orange', min: '1', max: '365', step: '1', inputmode: 'numeric', value: p.seuils.orange });
  const erreurs = h('div', { class: 'erreur-bloc', role: 'alert', hidden: true });
  const apercu = h('div', { class: 'apercu-seuils', 'aria-live': 'polite' });
  const majApercu = () => {
    const v = validerSeuils(rouge.value === '' ? '' : Number(rouge.value), orange.value === '' ? '' : Number(orange.value));
    rouge.setAttribute('aria-invalid', String(!v.ok)); orange.setAttribute('aria-invalid', String(!v.ok));
    if (!v.ok) { erreurs.hidden = false; vider(erreurs, ...v.erreurs.map((e) => h('p', {}, h('span', { 'aria-hidden': 'true' }, '✖ '), e))); vider(apercu); return v; }
    erreurs.hidden = true;
    const s = v.valeurs;
    vider(apercu, h('p', { class: 'discret' }, 'Aperçu :'), h('ul', { class: 'liste-apercu' },
      [-1, 0, s.rouge, s.rouge + 1, s.orange, s.orange + 1].filter((j, i, t) => t.indexOf(j) === i).map((j) => h('li', {}, badge(niveau(j, s), j)))));
    return v;
  };
  rouge.addEventListener('input', majApercu); orange.addEventListener('input', majApercu);
  majApercu();

  const enregistrerSeuils = async (e) => {
    e.preventDefault();
    const v = majApercu();
    if (!v.ok) { (rouge.getAttribute('aria-invalid') === 'true' ? rouge : orange).focus(); return; }
    p.seuils = v.valeurs;
    await app.sauver(`Seuils enregistrés : rouge ≤ ${v.valeurs.rouge} j, orange ≤ ${v.valeurs.orange} j.`);
  };
  const retablir = async () => {
    rouge.value = SEUILS_DEFAUT.rouge; orange.value = SEUILS_DEFAUT.orange; majApercu();
    p.seuils = { ...SEUILS_DEFAUT };
    await app.sauver('Valeurs par défaut rétablies (3 et 7 jours).');
  };

  // --- Jours chômés ---
  const listeChomes = h('ul', { class: 'liste-chomes' });
  const majChomes = () => vider(listeChomes, ...(p.joursChomes.length ? [...p.joursChomes].sort((a, b) => (a.date < b.date ? -1 : 1)).map((c) => h('li', {},
    `${dateCourte(c.date)} — ${c.libelle}`, ' ',
    h('button', { type: 'button', class: 'btn btn-petit btn-lien-danger', 'aria-label': `Retirer le ${dateCourte(c.date)}`, onclick: async () => {
      p.joursChomes = p.joursChomes.filter((x) => x !== c); recalculerTout(app); majChomes(); await app.sauver('Jour chômé retiré ; délais recalculés.');
    } }, 'Retirer'))) : [h('li', { class: 'discret' }, 'Aucun jour chômé saisi.')]));
  majChomes();
  const cDate = h('input', { type: 'date', id: 'c-date' });
  const cLib = h('input', { type: 'text', id: 'c-lib', placeholder: 'Ex. : greffe fermé, pont, jour férié local' });
  const ajouterChome = async (e) => {
    e.preventDefault();
    if (!estDateISO(cDate.value)) { annoncer('Indiquez une date valide.', 'erreur'); return; }
    p.joursChomes.push({ date: cDate.value, libelle: cLib.value.trim() || 'Jour chômé' });
    cDate.value = ''; cLib.value = '';
    recalculerTout(app); majChomes();
    await app.sauver('Jour chômé ajouté ; délais recalculés.');
  };

  // --- Sauvegarde ---
  const exporter = async () => {
    const chiffre = p.chiffrement && await confirmer('Format de la sauvegarde', 'Le chiffrement est activé. Voulez-vous un fichier chiffré (recommandé) ? Choisir « Annuler » produit un fichier en clair.', 'Fichier chiffré');
    const blob = await stockage.exporter(app.etat, { chiffre });
    telecharger(blob, `procivil-sauvegarde-${app.aujourdhui}${chiffre ? '-chiffree' : ''}.json`);
    p.derniereSauvegarde = new Date().toISOString();
    await app.sauver('Sauvegarde exportée. Conservez ce fichier en lieu sûr : il contient des données couvertes par le secret professionnel.');
  };
  const fichier = h('input', { type: 'file', id: 'import', accept: 'application/json,.json', class: 'visually-hidden', onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const texte = await f.text();
      let importe;
      try { importe = await stockage.lireFichier(texte); } catch (err) {
        if (err.message !== 'PHRASE_REQUISE') throw err;
        const phrase = await demanderPhrase('Sauvegarde chiffrée', 'Saisissez la phrase secrète utilisée lors de l\'export.');
        if (!phrase) return;
        importe = await stockage.lireFichier(texte, phrase);
      }
      const mode = await dialogue({
        titre: 'Importer une sauvegarde',
        contenu: h('p', {}, `Le fichier contient ${importe.affaires.length} affaire(s). Remplacer toutes les données actuelles (${app.etat.affaires.length} affaire(s)) ou fusionner ?`),
        boutons: [{ label: 'Annuler', valeur: null }, { label: 'Fusionner', valeur: 'fusion' }, { label: 'Tout remplacer', valeur: 'remplacer', classe: 'btn btn-danger' }],
      });
      if (!mode) return;
      const chiffrement = p.chiffrement;
      app.etat = mode === 'remplacer' ? { ...importe, parametres: { ...importe.parametres, chiffrement } } : stockage.fusionner(app.etat, importe);
      recalculerTout(app);
      await app.sauver(`Import terminé (${importe.affaires.length} affaire(s)).`);
      app.aller('#/');
    } catch (err) { annoncer(`Import impossible : ${err.message}`, 'erreur'); }
  } });
  const toutEffacer = async () => {
    if (!await confirmer('Effacer toutes les données ?', 'Toutes les affaires et tous les paramètres seront supprimés de ce navigateur. Cette action est irréversible : exportez d\'abord une sauvegarde.', 'Tout effacer')) return;
    stockage.effacerTout();
    app.etat = stockage.etatVide();
    app.etat.parametres.demoChargee = true;
    await app.sauver('Données effacées.');
    app.aller('#/');
  };
  const rechargerDemo = async () => {
    const { genererDemo } = await import('../model.js');
    const demo = genererDemo(app.regles.demo, app.regles, app.aujourdhui);
    app.etat.affaires = [...app.etat.affaires.filter((a) => !a.demo), ...demo];
    await app.sauver('Affaires de démonstration rechargées (dates recalculées par rapport à aujourd\'hui).');
    app.aller('#/');
  };

  // --- Chiffrement ---
  const blocChiffrement = h('div', {});
  const majChiffrement = () => vider(blocChiffrement, 
    h('p', {}, p.chiffrement ? '🔒 Les données de ce navigateur sont chiffrées (AES-GCM 256 bits, clé dérivée de votre phrase secrète).' : '🔓 Les données sont stockées en clair dans ce navigateur.'),
    h('p', { class: 'aide' }, 'Le chiffrement protège les données si quelqu\'un accède au poste ou au profil du navigateur. La phrase secrète n\'est jamais enregistrée : en cas d\'oubli, les données sont perdues, sauf sauvegarde en clair. Il nécessite une page servie en HTTPS (ou localhost).'),
    p.chiffrement
      ? h('button', { type: 'button', class: 'btn', onclick: async () => { if (await confirmer('Désactiver le chiffrement ?', 'Les données seront réenregistrées en clair dans ce navigateur.', 'Désactiver')) { await stockage.desactiverChiffrement(app.etat); majChiffrement(); annoncer('Chiffrement désactivé.', 'succes'); } } }, 'Désactiver le chiffrement')
      : h('button', { type: 'button', class: 'btn', onclick: async () => {
        const p1 = await demanderPhrase('Activer le chiffrement', 'Choisissez une phrase secrète d\'au moins 12 caractères. Elle vous sera demandée à chaque ouverture.');
        if (!p1) return;
        if (p1.length < 12) { annoncer('Phrase trop courte (12 caractères minimum).', 'erreur'); return; }
        const p2 = await demanderPhrase('Confirmation', 'Saisissez à nouveau la phrase secrète.');
        if (p1 !== p2) { annoncer('Les deux saisies diffèrent.', 'erreur'); return; }
        try { await stockage.activerChiffrement(app.etat, p1); majChiffrement(); annoncer('Chiffrement activé.', 'succes'); } catch (e) { annoncer(e.message, 'erreur'); }
      } }, 'Activer le chiffrement'));
  majChiffrement();

  // --- IA externe (désactivée par défaut) ---
  const iaActive = h('input', { type: 'checkbox', id: 'ia-active', checked: p.ia.active });
  const iaUrl = h('input', { type: 'url', id: 'ia-url', placeholder: 'https://mon-proxy.exemple.workers.dev/extraire', value: p.ia.urlProxy });
  const iaJeton = h('input', { type: 'password', id: 'ia-jeton', autocomplete: 'off', value: p.ia.jeton, placeholder: 'Jeton d\'accès à VOTRE proxy (pas la clé API)' });
  const enregistrerIA = async (e) => {
    e.preventDefault();
    if (iaActive.checked && !/^https:\/\//.test(iaUrl.value)) { annoncer('L\'adresse du proxy doit commencer par https://', 'erreur'); return; }
    if (iaActive.checked && !p.ia.active && !await confirmer('Activer l\'analyse par IA externe ?', 'Le texte extrait des documents sera envoyé à votre proxy, puis au fournisseur d\'IA. Ces données sortent alors du navigateur : vérifiez votre conformité au secret professionnel et au RGPD (contrat de sous-traitance, localisation, durée de conservation). Une confirmation sera demandée à chaque envoi.', 'Activer')) return;
    p.ia = { active: iaActive.checked, urlProxy: iaUrl.value.trim(), jeton: iaJeton.value };
    await app.sauver(p.ia.active ? 'Analyse par IA externe activée.' : 'Analyse par IA externe désactivée.');
  };

  const annee = Number(app.aujourdhui.slice(0, 4));
  racine.append(
    lienRetour(),
    h('h1', {}, 'Paramètres'),

    h('form', { class: 'carte', onsubmit: enregistrerSeuils, novalidate: true, 'aria-labelledby': 't-seuils' },
      h('h2', { id: 't-seuils' }, 'Seuils d\'alerte'),
      h('p', { class: 'aide' }, 'Nombre de jours restants à partir duquel un délai passe en rouge (urgent) ou en orange (à surveiller). Ils s\'appliquent immédiatement au tableau de bord et aux frises, sauf pour les affaires qui ont leurs propres seuils.'),
      h('div', { class: 'grille-2' },
        champ({ label: 'Seuil rouge : expire dans N jours ou moins', id: 's-rouge', aide: 'Par défaut : 3 jours.' }, rouge),
        champ({ label: 'Seuil orange : expire dans N jours ou moins', id: 's-orange', aide: 'Par défaut : 7 jours. Doit être strictement supérieur au seuil rouge.' }, orange)),
      erreurs, apercu,
      h('div', { class: 'actions' },
        h('button', { type: 'submit', class: 'btn btn-principal' }, 'Enregistrer les seuils'),
        h('button', { type: 'button', class: 'btn', onclick: retablir }, 'Rétablir les valeurs par défaut'))),

    h('form', { class: 'carte', onsubmit: ajouterChome, 'aria-labelledby': 't-chomes' },
      h('h2', { id: 't-chomes' }, 'Jours chômés supplémentaires'),
      h('p', { class: 'aide' }, 'Art. 642 al. 2 CPC : un délai qui expire un jour « chômé » est prorogé. Ajoutez ici les fermetures exceptionnelles du greffe ou les jours fériés locaux non modélisés (Pacifique). Les délais sont recalculés.'),
      listeChomes,
      h('div', { class: 'grille-3 aligne-bas' }, champ({ label: 'Date', id: 'c-date' }, cDate), champ({ label: 'Motif', id: 'c-lib' }, cLib), h('button', { type: 'submit', class: 'btn' }, 'Ajouter')),
      h('details', {}, h('summary', {}, `Jours fériés calculés pour ${annee} (métropole et Alsace-Moselle)`),
        h('ul', { class: 'liste-feries' }, listeFeries(annee, 'alsace-moselle', app.regles.feries).map(([d, l]) => h('li', {}, `${dateCourte(d)} — ${l}`))))),

    h('div', { class: 'carte', 'aria-labelledby': 't-donnees' },
      h('h2', { id: 't-donnees' }, 'Données et sauvegarde'),
      h('p', {}, `${app.etat.affaires.length} affaire(s) enregistrée(s) dans ce navigateur. ${p.derniereSauvegarde ? `Dernière sauvegarde exportée le ${dateCourte(p.derniereSauvegarde.slice(0, 10))}.` : 'Aucune sauvegarde exportée.'}`),
      h('ul', { class: 'aide' },
        h('li', {}, 'Les données sont stockées uniquement dans ce navigateur (localStorage), sur ce poste. Elles ne sont ni synchronisées ni envoyées à un serveur.'),
        h('li', {}, 'Elles sont perdues si vous effacez les données de navigation ou changez de navigateur ou de poste : exportez régulièrement une sauvegarde.'),
        h('li', {}, 'Le fichier exporté contient des données couvertes par le secret professionnel : stockez-le sur un support chiffré.')),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn btn-principal', onclick: exporter }, '⬇ Exporter (JSON)'),
        h('label', { class: 'btn', for: 'import' }, '⬆ Importer…'), fichier,
        h('button', { type: 'button', class: 'btn', onclick: rechargerDemo }, 'Recharger les affaires de démonstration'),
        h('button', { type: 'button', class: 'btn btn-danger', onclick: toutEffacer }, 'Tout effacer'))),

    h('div', { class: 'carte', 'aria-labelledby': 't-chiffrement' }, h('h2', { id: 't-chiffrement' }, 'Chiffrement local'), blocChiffrement),

    h('form', { class: 'carte', onsubmit: enregistrerIA, 'aria-labelledby': 't-ia' },
      h('h2', { id: 't-ia' }, 'Analyse des documents par IA externe (facultatif)'),
      h('p', { class: 'aide' }, 'Par défaut, les documents sont analysés uniquement dans le navigateur (PDF.js, Tesseract.js, expressions régulières). Vous pouvez y ajouter votre propre proxy (par exemple un Cloudflare Worker, voir proxy/ et docs/IA-EXTERNE.md) qui détient la clé API. La clé n\'est jamais dans le site.'),
      h('label', { class: 'case' }, iaActive, ' Activer l\'analyse complémentaire par IA'),
      champ({ label: 'Adresse du proxy', id: 'ia-url' }, iaUrl),
      champ({ label: 'Jeton d\'accès au proxy', id: 'ia-jeton', aide: 'Secret partagé propre à votre proxy, stocké dans ce navigateur : ce n\'est pas la clé API du fournisseur.' }, iaJeton),
      h('button', { type: 'submit', class: 'btn' }, 'Enregistrer')),

    h('div', { class: 'carte' },
      h('h2', {}, 'À propos des règles'),
      h('p', {}, `Catalogue des délais : version ${app.regles.catalogue.meta.version} (mise à jour ${app.regles.catalogue.meta.miseAJour}). Jours fériés : version ${app.regles.feries.meta.version}.`),
      h('p', { class: 'aide' }, app.regles.catalogue.meta.avertissement),
      h('p', {}, h('a', { href: 'tests.html' }, 'Lancer le jeu de tests'), ' · ', h('a', { href: 'docs/ARCHITECTURE.md' }, 'Documentation technique'))),
  );
  return racine;
}

function recalculerTout(app) {
  for (const a of app.etat.affaires) recalculerAffaire(a, app.regles, app.joursChomes());
}
