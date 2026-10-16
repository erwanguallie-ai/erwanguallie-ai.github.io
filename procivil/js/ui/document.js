// Module 3 : dépôt d'un document (PDF ou image), extraction locale du texte
// (PDF.js, puis OCR Tesseract.js si le PDF est scanné), repérage des
// informations clés, pré-remplissage soumis à validation obligatoire.
import { h, vider, champ, annoncer, confirmer } from './dom.js';
import { lienRetour, selectTypeActe, selectResidence, selectZoneFeries, selectLieuJuridiction, champCommune, bandeauAvertissement, dateLongue } from './composants.js';
import { chercherCommunes } from '../lib/competence.js';
import { extraireInformations } from '../lib/extraction.js';
import { estDateISO } from '../lib/dates.js';
import { trouverType, libelleDuree } from '../lib/delais.js';
import { creerAffaire, ajouterActe, ajouterDelai } from '../model.js';

const TAILLE_MAX = 25 * 1024 * 1024;
const BASE = new URL('../../vendor/', import.meta.url).href;

let pdfjs = null;
async function chargerPdfjs() {
  if (!pdfjs) {
    pdfjs = await import(`${BASE}pdfjs/pdf.min.js`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${BASE}pdfjs/pdf.worker.min.js`;
  }
  return pdfjs;
}

let tesseractCharge = null;
function chargerTesseract() {
  tesseractCharge ||= new Promise((ok, ko) => {
    if (window.Tesseract) { ok(window.Tesseract); return; }
    const s = document.createElement('script');
    s.src = `${BASE}tesseract/tesseract.min.js`;
    s.onload = () => ok(window.Tesseract);
    s.onerror = () => ko(new Error('Impossible de charger le moteur OCR (vendor/tesseract).'));
    document.head.append(s);
  });
  return tesseractCharge;
}

async function ocr(images, progression) {
  const T = await chargerTesseract();
  const worker = await T.createWorker('fra', 1, {
    workerPath: `${BASE}tesseract/worker.min.js`,
    corePath: `${BASE}tesseract/core`,
    langPath: `${BASE}tesseract/lang`,
    gzip: false,
    logger: (m) => { if (m.status === 'recognizing text') progression(`Reconnaissance du texte… ${Math.round(m.progress * 100)} %`); },
  });
  try {
    let texte = '';
    for (let i = 0; i < images.length; i += 1) {
      progression(`OCR page ${i + 1}/${images.length}…`);
      const { data } = await worker.recognize(images[i]);
      texte += `${data.text}\n`;
    }
    return texte;
  } finally {
    await worker.terminate();
  }
}

async function texteDepuisPdf(fichier, progression) {
  const lib = await chargerPdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()), isEvalSupported: false }).promise;
  const pages = Math.min(doc.numPages, 20);
  let texte = '';
  const scans = [];
  for (let i = 1; i <= pages; i += 1) {
    progression(`Lecture du PDF : page ${i}/${pages}…`);
    const page = await doc.getPage(i);
    const contenu = await page.getTextContent();
    const t = contenu.items.map((x) => x.str + (x.hasEOL ? '\n' : ' ')).join('');
    if (t.replace(/\s/g, '').length < 40) {
      // Page sans couche texte (scan) : rendu en image pour l'OCR.
      const vue = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = vue.width; canvas.height = vue.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vue, canvas }).promise;
      scans.push(canvas);
    }
    texte += `${t}\n`;
  }
  if (scans.length) texte += await ocr(scans, progression);
  return { texte, pages: doc.numPages, ocr: scans.length > 0 };
}

async function analyseIA(app, texte) {
  const { urlProxy, jeton } = app.etat.parametres.ia;
  const r = await fetch(urlProxy, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
    body: JSON.stringify({ texte: texte.slice(0, 60000) }),
  });
  if (!r.ok) throw new Error(`Le proxy a répondu ${r.status}.`);
  return r.json();
}

export function vueDocument(app, idAffaire) {
  const { regles } = app;
  const aff = idAffaire ? app.affaire(idAffaire) : null;
  const zone = h('div', {});
  const statut = h('p', { class: 'statut-analyse', role: 'status', 'aria-live': 'polite' });
  const progression = (t) => { statut.textContent = t; };

  const traiter = async (fichier) => {
    if (!fichier) return;
    if (fichier.size > TAILLE_MAX) { annoncer('Fichier trop volumineux (25 Mo maximum).', 'erreur'); return; }
    vider(zone);
    try {
      let res;
      if (fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name)) res = await texteDepuisPdf(fichier, progression);
      else if (/^image\//.test(fichier.type)) res = { texte: await ocr([fichier], progression), pages: 1, ocr: true };
      else throw new Error('Format non pris en charge : déposez un PDF ou une image (JPEG, PNG).');
      progression(`Analyse terminée${res.ocr ? ' (OCR utilisé : relisez attentivement les dates)' : ''}.`);
      const infos = extraireInformations(res.texte);
      vider(zone, formulaireValidation(app, aff, fichier, res, infos));
    } catch (e) {
      console.error(e);
      progression('');
      annoncer(`Analyse impossible : ${e.message}`, 'erreur');
    }
  };

  const input = h('input', { type: 'file', id: 'doc', accept: 'application/pdf,image/jpeg,image/png,image/webp', onchange: (e) => traiter(e.target.files[0]) });
  const depot = h('label', { class: 'zone-depot', for: 'doc',
    ondragover: (e) => { e.preventDefault(); depot.classList.add('survol'); },
    ondragleave: () => depot.classList.remove('survol'),
    ondrop: (e) => { e.preventDefault(); depot.classList.remove('survol'); traiter(e.dataTransfer.files[0]); } },
  h('span', { class: 'grande-icone', 'aria-hidden': 'true' }, '📄'),
  h('strong', {}, 'Déposez un acte ici ou cliquez pour choisir un fichier'),
  h('span', { class: 'discret' }, 'PDF (texte ou scanné) ou photo : assignation, signification, jugement… 25 Mo maximum.'));

  return h('section', { class: 'vue vue-document' },
    lienRetour(aff ? `#/affaire/${aff.id}` : '#/nouvelle', aff ? aff.nom : 'Nouvelle affaire'),
    h('h1', {}, aff ? `Déposer un document — ${aff.nom}` : 'Créer une affaire à partir d\'un document'),
    bandeauAvertissement(),
    h('div', { class: 'carte' },
      h('p', { class: 'confidentialite' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), h('strong', {}, 'Traitement local : '),
        'le document est lu et analysé dans votre navigateur. Il n\'est ni envoyé sur Internet ni conservé : seules les informations que vous validez sont enregistrées.',
        app.etat.parametres.ia.active ? ' L\'analyse complémentaire par IA externe est activée : une confirmation vous sera demandée avant tout envoi.' : ''),
      h('div', {}, input, depot), statut),
    zone);
}

function formulaireValidation(app, aff, fichier, res, infos) {
  const { regles } = app;
  const v = (x) => x?.valeur ?? '';
  const nature = infos.nature?.valeur || 'autre';
  const f = {
    nom: h('input', { type: 'text', id: 'v-nom', value: aff ? aff.nom : [v(infos.requerant), v(infos.destinataire)].filter(Boolean).join(' c/ ') }),
    demandeur: h('input', { type: 'text', id: 'v-dem', value: v(infos.requerant) }),
    defendeur: h('input', { type: 'text', id: 'v-def', value: v(infos.destinataire) }),
    rg: h('input', { type: 'text', id: 'v-rg', value: v(infos.rg) }),
    juridiction: h('input', { type: 'text', id: 'v-jur', value: v(infos.juridiction) }),
    typeActe: selectTypeActe(regles.catalogue, nature, { id: 'v-type' }),
    dateActe: h('input', { type: 'date', id: 'v-date', value: v(infos.dateActe) }),
    dateAudience: h('input', { type: 'date', id: 'v-aud', value: v(infos.dateAudience) }),
    domicile: h('input', { type: 'text', id: 'v-domicile', value: v(infos.domicile) }),
    residence: selectResidence(regles.distance, aff?.contexte.residence || 'metropole', { id: 'v-resid' }),
    valide: h('input', { type: 'checkbox', id: 'v-valide' }),
    zone: selectZoneFeries(regles.feries, aff?.contexte.zoneFeries, { id: 'v-zone' }),
    lieu: selectLieuJuridiction(regles.distance, aff?.contexte.lieuJuridiction, { id: 'v-lieu' }),
  };
  const infoZone = h('p', { class: 'aide', 'aria-live': 'polite' });
  // Déduit les jours fériés et le siège à partir de la ville de la juridiction mentionnée.
  const deduireZone = async () => {
    const nom = f.juridiction.value;
    const morceaux = [...nom.matchAll(/(?:\s(?:de|du|des)\s|\sd')/g)].map((m) => nom.slice(m.index + m[0].length).trim()).reverse();
    if (!morceaux.length) return;
    const { index } = await app.chargerCommunes();
    for (const ville of morceaux) {
      const cand = chercherCommunes(index, ville, 50).filter((c) => c.cle === ville.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim());
      if (!cand.length) continue;
      const zones = new Set(cand.map((c) => app.zoneDepuisDep(c.dep)));
      if (zones.size > 1) { infoZone.textContent = `Plusieurs communes « ${ville} » relèvent de zones différentes : choisissez les jours fériés manuellement.`; return; }
      const c = cand[0];
      f.zone.value = app.zoneDepuisDep(c.dep);
      const resid = regles.distance.departementsVersResidence[c.dep];
      f.lieu.value = resid && [...f.lieu.options].some((o) => o.value === resid) ? resid : 'metropole';
      infoZone.textContent = `Déduit de « ${ville} » (dép. ${c.dep}) : ${regles.feries.zones[f.zone.value].libelle}. Vérifiez.`;
      return;
    }
  };
  f.juridiction.addEventListener('change', deduireZone);
  // Pré-sélection de la commune du défendeur à partir du code postal extrait.
  if (infos.domicile?.codePostal) {
    app.chargerCommunes().then(({ index }) => {
      const cle = (infos.domicile.commune || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-'’]/g, ' ').trim();
      const cand = chercherCommunes(index, infos.domicile.codePostal, 30);
      const c = cand.find((x) => x.cle === cle) || (cand.length === 1 ? cand[0] : null);
      const input = document.getElementById('v-commune');
      if (c && input && !communeDefendeur) { communeDefendeur = { insee: c.insee, nom: c.nom, dep: c.dep }; input.value = `${c.nom} (${c.dep})`; }
    });
  }
  if (!aff) deduireZone();
  let communeDefendeur = null;
  const sugg = h('fieldset', { class: 'suggestions-delais' });
  const majSugg = () => {
    const def = regles.catalogue.actes.find((x) => x.id === f.typeActe.value);
    const ids = [...def.suggestions];
    vider(sugg, h('legend', {}, 'Délais à créer (cochez ceux qui s\'appliquent)'),
      ids.length ? ids.map((id, i) => { const t = trouverType(regles.catalogue, id); return h('label', { class: 'case' }, h('input', { type: 'checkbox', value: id, checked: i === 0 }), ` ${t.libelle} — ${libelleDuree(t.duree)} (${t.article})`); }) : h('p', { class: 'discret' }, 'Aucun délai proposé pour ce type d\'acte.'),
      f.dateAudience.value ? h('label', { class: 'case' }, h('input', { type: 'checkbox', value: 'remise_assignation', dataset: { audience: '1' }, checked: f.typeActe.value === 'assignation' }), ' Remise de l\'assignation au greffe 15 jours avant l\'audience (art. 754 CPC)') : null);
  };
  f.typeActe.addEventListener('change', majSugg);
  f.dateAudience.addEventListener('change', majSugg);
  majSugg();

  const indice = (x) => (x ? h('p', { class: 'indice' }, h('span', { class: `confiance confiance-${x.confiance}` }, `confiance ${x.confiance}`), ' « ', x.extrait.replace(/\s+/g, ' ').slice(0, 160), ' »') : h('p', { class: 'indice discret' }, 'Non trouvé dans le document.'));
  const dates = infos.dates.length ? h('details', {}, h('summary', {}, `${infos.dates.length} date(s) repérée(s) dans le document`),
    h('ul', {}, infos.dates.map((d) => h('li', {}, h('button', { type: 'button', class: 'btn btn-petit', onclick: () => { f.dateActe.value = d.valeur; majSugg(); } }, `Utiliser le ${dateLongue(d.valeur)}`), ' ', h('span', { class: 'discret' }, d.extrait.replace(/\s+/g, ' ').slice(-120)))))) : null;

  const erreur = h('div', { class: 'erreur', role: 'alert', hidden: true });
  const enregistrer = async (e) => {
    e.preventDefault();
    const pb = [];
    if (!f.valide.checked) pb.push('Cochez la case de validation après avoir vérifié chaque information.');
    if (!estDateISO(f.dateActe.value)) pb.push('La date de l\'acte est obligatoire.');
    if (!aff && !f.nom.value.trim()) pb.push('Le nom de l\'affaire est obligatoire.');
    if (pb.length) { erreur.hidden = false; vider(erreur, ...pb.map((x) => h('p', {}, x))); erreur.focus?.(); return; }
    let a = aff;
    if (!a) {
      a = creerAffaire({ nom: f.nom.value, demandeur: f.demandeur.value, defendeur: f.defendeur.value, rg: f.rg.value, client: 'defendeur', residence: f.residence.value, zoneFeries: f.zone.value, lieuJuridiction: f.lieu.value, juridiction: { libelle: f.juridiction.value, nomPrecis: f.juridiction.value } });
      app.etat.affaires.push(a);
    } else if (!a.juridiction?.nomPrecis && f.juridiction.value) {
      a.juridiction = { ...(a.juridiction || {}), libelle: f.juridiction.value, nomPrecis: f.juridiction.value };
    }
    if (communeDefendeur) a.parties.communeDefendeur = communeDefendeur;
    const document = { nom: fichier.name, taille: fichier.size, analyseLe: app.aujourdhui };
    const lib = regles.catalogue.actes.find((x) => x.id === f.typeActe.value).libelle;
    const acte = ajouterActe(a, { type: f.typeActe.value, libelle: lib, date: f.dateActe.value, source: 'document', document });
    let acteAudience = null;
    if (estDateISO(f.dateAudience.value)) acteAudience = ajouterActe(a, { type: 'audience', libelle: 'Audience', date: f.dateAudience.value, source: 'document', document });
    const resid = f.residence.value !== a.contexte.residence ? f.residence.value : null;
    for (const c of sugg.querySelectorAll('input:checked')) {
      const surAudience = c.dataset.audience && acteAudience;
      ajouterDelai(a, { typeId: c.value, acteId: surAudience ? acteAudience.id : acte.id, residence: resid }, regles, app.joursChomes());
    }
    await app.sauver('Informations validées et enregistrées.');
    if (communeDefendeur && !a.juridiction?.code && await confirmer('Compétence', `Voulez-vous lancer l'assistant de compétence avec le domicile du défendeur (${communeDefendeur.nom}) ?`, 'Lancer l\'assistant')) {
      app.aller(`#/competence/${a.id}`); return;
    }
    app.aller(`#/affaire/${a.id}`);
  };

  const blocIA = app.etat.parametres.ia.active ? h('div', { class: 'carte-ia' },
    h('button', { type: 'button', class: 'btn', onclick: async () => {
      if (!await confirmer('Envoyer le texte à l\'IA externe ?', 'Le texte extrait (et non le fichier) sera transmis à votre proxy puis au fournisseur d\'IA. Ne le faites que si votre client y a consenti ou si le cadre contractuel le permet.', 'Envoyer')) return;
      try {
        const r = await analyseIA(app, res.texte);
        if (r.date_acte && estDateISO(r.date_acte)) f.dateActe.value = r.date_acte;
        if (r.date_audience && estDateISO(r.date_audience)) f.dateAudience.value = r.date_audience;
        if (r.juridiction) f.juridiction.value = r.juridiction;
        if (r.demandeur) f.demandeur.value = r.demandeur;
        if (r.defendeur) f.defendeur.value = r.defendeur;
        if (r.nature && regles.catalogue.actes.some((x) => x.id === r.nature)) f.typeActe.value = r.nature;
        if (r.domicile_defendeur) f.domicile.value = r.domicile_defendeur;
        majSugg();
        annoncer('Suggestions de l\'IA appliquées : vérifiez chaque champ.', 'info');
      } catch (err) { annoncer(`Analyse IA impossible : ${err.message}`, 'erreur'); }
    } }, '✨ Compléter avec l\'IA externe')) : null;

  return h('form', { class: 'carte formulaire validation-document', onsubmit: enregistrer, novalidate: true },
    h('h2', {}, 'Vérifiez les informations extraites'),
    h('p', { class: 'aide' }, `${fichier.name} · ${res.pages} page(s)${res.ocr ? ' · OCR' : ''}. Chaque champ est pré-rempli à partir du document, avec l'extrait qui l'a justifié. Corrigez si nécessaire : rien n'est enregistré sans votre validation.`),
    infos.avertissements.length ? h('ul', { class: 'avertissements' }, infos.avertissements.map((x) => h('li', {}, x))) : null,
    blocIA,
    aff ? null : champ({ label: 'Nom de l\'affaire', id: 'v-nom', requis: true }, f.nom),
    aff ? null : h('div', { class: 'grille-2' },
      h('div', {}, champ({ label: 'Demandeur (requérant)', id: 'v-dem' }, f.demandeur), indice(infos.requerant)),
      h('div', {}, champ({ label: 'Défendeur (destinataire)', id: 'v-def' }, f.defendeur), indice(infos.destinataire))),
    h('div', { class: 'grille-2' },
      h('div', {}, champ({ label: 'Nature de l\'acte', id: 'v-type' }, f.typeActe), indice(infos.nature)),
      h('div', {}, champ({ label: 'Date de l\'acte (signification, délivrance…)', id: 'v-date', requis: true }, f.dateActe), indice(infos.dateActe))),
    dates,
    h('div', { class: 'grille-2' },
      h('div', {}, champ({ label: 'Date d\'audience', id: 'v-aud' }, f.dateAudience), indice(infos.dateAudience)),
      h('div', {}, champ({ label: 'Juridiction mentionnée', id: 'v-jur' }, f.juridiction), indice(infos.juridiction))),
    aff ? null : h('div', { class: 'grille-2' },
      champ({ label: 'Jours fériés à appliquer', id: 'v-zone', aide: 'Ceux du lieu de la juridiction (Alsace-Moselle, outre-mer…).' }, f.zone),
      champ({ label: 'Siège de la juridiction', id: 'v-lieu' }, f.lieu)),
    aff ? null : infoZone,
    h('div', { class: 'grille-2' },
      h('div', {}, champ({ label: 'Domicile du défendeur', id: 'v-domicile' }, f.domicile), indice(infos.domicile),
        champCommune(app, { id: 'v-commune', label: 'Commune du défendeur (pour l\'assistant de compétence)', valeur: null, onChoix: (c) => { communeDefendeur = { insee: c.insee, nom: c.nom, dep: c.dep }; } })),
      h('div', {}, champ({ label: 'Résidence de la partie qui doit agir', id: 'v-resid', aide: 'Délais de distance (art. 643 et 644 CPC).' }, f.residence), infos.rg ? h('div', {}, champ({ label: 'Numéro RG', id: 'v-rg' }, f.rg), indice(infos.rg)) : null)),
    sugg,
    h('details', {}, h('summary', {}, 'Texte extrait du document'), h('pre', { class: 'texte-extrait' }, res.texte.slice(0, 20000))),
    h('label', { class: 'case case-validation' }, f.valide, h('strong', {}, ' J\'ai vérifié chacune de ces informations au regard de l\'original'), ' (validation obligatoire avant enregistrement).'),
    erreur,
    h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'btn btn-principal' }, aff ? 'Ajouter à l\'affaire' : 'Créer l\'affaire'), h('a', { class: 'btn', href: aff ? `#/affaire/${aff.id}` : '#/' }, 'Abandonner')));
}

