// Point d'entrée : chargement des règles, de l'état local, routage par ancre (#/…).
import * as stockage from './storage.js';
import { aujourdhuiISO } from './lib/dates.js';
import { zoneDepuisDepartement } from './lib/feries.js';
import { indexerCommunes } from './lib/competence.js';
import { genererDemo } from './model.js';
import { h, vider, annoncer, demanderPhrase } from './ui/dom.js';
import { vueTableau } from './ui/dashboard.js';
import { vueFiche } from './ui/fiche.js';
import { vueParametres } from './ui/settings.js';
import { vueNouvelle } from './ui/nouvelle.js';
import { vueCalculateur } from './ui/calculateur.js';
import { vueCompetence } from './ui/competence.js';
import { vueDocument } from './ui/document.js';

const FICHIERS = {
  catalogue: 'data/delais.json',
  feries: 'data/feries.json',
  distance: 'data/distance.json',
  competence: 'data/competence.json',
  demo: 'data/demo.json',
};

export const app = {
  etat: null,
  regles: null,
  communes: null,
  juridictions: null,
  aujourdhui: aujourdhuiISO(),

  async sauver(message) {
    try {
      await stockage.enregistrer(this.etat);
      if (message) annoncer(message, 'succes');
    } catch (e) {
      annoncer(e.message, 'erreur');
    }
  },
  affaire(id) { return this.etat.affaires.find((a) => a.id === id); },
  joursChomes() { return this.etat.parametres.joursChomes; },
  zoneDepuisDep(dep) { return zoneDepuisDepartement(dep, app.regles.feries); },
  aller(chemin) { location.hash = chemin; },

  // Données lourdes chargées à la demande (communes : ~1,3 Mo).
  async chargerCommunes() {
    if (!this.communes) {
      const [c, j] = await Promise.all([lireJSON('data/communes.json'), lireJSON('data/juridictions/echantillon.json')]);
      this.communes = indexerCommunes(c);
      this.juridictions = j;
    }
    return { index: this.communes, juridictions: this.juridictions };
  },
};

async function lireJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Impossible de charger ${url} (HTTP ${r.status}).`);
  return r.json();
}

async function chargerRegles() {
  const entrees = await Promise.all(Object.entries(FICHIERS).map(async ([k, url]) => [k, await lireJSON(url)]));
  return Object.fromEntries(entrees);
}

async function chargerEtat() {
  if (!stockage.stockageDisponible()) {
    annoncer("Le stockage local est bloqué dans ce navigateur (navigation privée ?). Les données ne seront pas conservées : exportez-les avant de fermer l'onglet.", 'erreur');
    return null;
  }
  for (let essai = 0; essai < 5; essai += 1) {
    try {
      return await stockage.charger(essai ? await demanderPhrase('Données chiffrées', 'Vos données sont chiffrées sur ce navigateur. Saisissez votre phrase secrète.') : null);
    } catch (e) {
      if (e.message === 'PHRASE_REQUISE') continue;
      if (/Phrase secrète/.test(e.message)) { annoncer(e.message, 'erreur'); continue; }
      throw e;
    }
  }
  throw new Error('Données chiffrées non déverrouillées.');
}

const routes = [
  [/^#?\/?$/, () => vueTableau(app)],
  [/^#\/affaire\/([\w-]+)$/, (m) => vueFiche(app, m[1])],
  [/^#\/nouvelle$/, () => vueNouvelle(app)],
  [/^#\/parametres$/, () => vueParametres(app)],
  [/^#\/calculateur(?:\/([\w-]+))?$/, (m) => vueCalculateur(app, m[1])],
  [/^#\/competence(?:\/([\w-]+))?$/, (m) => vueCompetence(app, m[1])],
  [/^#\/document(?:\/([\w-]+))?$/, (m) => vueDocument(app, m[1])],
];

async function router() {
  app.aujourdhui = aujourdhuiISO();
  const main = document.getElementById('contenu');
  const hash = location.hash || '#/';
  for (const [re, vue] of routes) {
    const m = re.exec(hash);
    if (m) {
      try {
        vider(main, await vue(m));
      } catch (e) {
        console.error(e);
        vider(main, h('div', { class: 'carte erreur-bloc', role: 'alert' }, h('h2', {}, 'Erreur'), h('p', {}, e.message), h('a', { href: '#/' }, 'Retour au tableau de bord')));
      }
      document.querySelectorAll('[data-nav]').forEach((a) => a.setAttribute('aria-current', hash.startsWith(a.getAttribute('href')) && (a.getAttribute('href') !== '#/' || hash === '#/') ? 'page' : 'false'));
      main.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}

async function demarrer() {
  const main = document.getElementById('contenu');
  if (location.protocol === 'file:') {
    vider(main, h('div', { class: 'carte erreur-bloc' }, h('h2', {}, 'Ouvrez l\'outil via un serveur web'),
      h('p', {}, "Les navigateurs bloquent le chargement des fichiers de règles (JSON) et des modules JavaScript en ouvrant index.html directement depuis le disque."),
      h('p', {}, 'En local : lancez « python3 -m http.server 8000 » dans le dossier, puis ouvrez http://localhost:8000. En ligne : publiez le dossier sur vos pages perso Free (voir docs/DEPLOIEMENT.md).')));
    return;
  }
  try {
    app.regles = await chargerRegles();
    app.etat = (await chargerEtat()) || stockage.etatVide();
    if (!app.etat.parametres.demoChargee && app.etat.affaires.length === 0) {
      app.etat.affaires = genererDemo(app.regles.demo, app.regles, app.aujourdhui);
      app.etat.parametres.demoChargee = true;
      await app.sauver();
    }
  } catch (e) {
    vider(main, h('div', { class: 'carte erreur-bloc', role: 'alert' }, h('h2', {}, 'Démarrage impossible'), h('p', {}, e.message)));
    return;
  }
  window.addEventListener('hashchange', router);
  router();
}

demarrer();
