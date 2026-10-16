// Petits utilitaires DOM. Tout le texte passe par textContent : aucune donnée
// saisie ou importée n'est injectée comme HTML.

export function h(tag, attrs = {}, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  ajouter(el, enfants);
  return el;
}

function ajouter(el, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
}

export function vider(el, ...enfants) {
  el.replaceChildren();
  ajouter(el, enfants);
  return el;
}

export function champ({ label, id, aide, erreur, requis }, controle) {
  if (id) controle.id = id;
  if (requis) controle.required = true;
  const idAide = aide && id ? `${id}-aide` : null;
  if (idAide) controle.setAttribute('aria-describedby', idAide);
  return h('div', { class: 'champ' },
    h('label', { for: id }, label, requis ? h('span', { class: 'requis', 'aria-hidden': 'true' }, ' *') : null),
    controle,
    aide ? h('p', { class: 'aide', id: idAide }, aide) : null,
    erreur ? h('p', { class: 'erreur', role: 'alert' }, erreur) : null);
}

export function select(options, valeur, attrs = {}) {
  const s = h('select', attrs);
  for (const o of options) {
    if (o.groupe) {
      const g = h('optgroup', { label: o.groupe });
      for (const x of o.options) g.append(h('option', { value: x.value, selected: x.value === valeur }, x.label));
      s.append(g);
    } else {
      s.append(h('option', { value: o.value, selected: o.value === valeur }, o.label));
    }
  }
  return s;
}

let zoneAnnonce;
export function annoncer(message, type = 'info') {
  zoneAnnonce ||= document.getElementById('annonces');
  const t = h('div', { class: `toast toast-${type}`, role: type === 'erreur' ? 'alert' : 'status' }, message);
  zoneAnnonce.append(t);
  setTimeout(() => t.remove(), type === 'erreur' ? 9000 : 4500);
}

export function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nom });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Boîte de dialogue modale native (<dialog>). Retourne une promesse.
export function dialogue({ titre, contenu, boutons = [{ label: 'Fermer', valeur: null }] }) {
  return new Promise((resolve) => {
    const d = h('dialog', { class: 'dialogue', 'aria-labelledby': 'dlg-titre' },
      h('h2', { id: 'dlg-titre' }, titre),
      h('div', { class: 'dialogue-corps' }, contenu),
      h('div', { class: 'actions' }, boutons.map((b) => h('button', {
        type: 'button', class: b.classe || (b.valeur ? 'btn btn-principal' : 'btn'),
        onclick: () => { const v = typeof b.valeur === 'function' ? b.valeur(d) : b.valeur; if (v === undefined) return; d.close(); d.remove(); resolve(v); },
      }, b.label))));
    d.addEventListener('cancel', () => { d.remove(); resolve(null); });
    document.body.append(d);
    d.showModal();
  });
}

export function confirmer(titre, message, libelleOk = 'Confirmer') {
  return dialogue({ titre, contenu: h('p', {}, message), boutons: [{ label: 'Annuler', valeur: false }, { label: libelleOk, valeur: true, classe: 'btn btn-danger' }] });
}

export function demanderPhrase(titre, message) {
  const input = h('input', { type: 'password', autocomplete: 'current-password', id: 'dlg-phrase' });
  const contenu = h('div', {}, h('p', {}, message), champ({ label: 'Phrase secrète', id: 'dlg-phrase' }, input));
  setTimeout(() => input.focus(), 50);
  return dialogue({ titre, contenu, boutons: [{ label: 'Annuler', valeur: null }, { label: 'Valider', valeur: () => input.value || undefined }] });
}
