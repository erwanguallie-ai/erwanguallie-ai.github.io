// Chiffrement local optionnel (WebCrypto) : AES-GCM 256 bits, clé dérivée
// d'une phrase secrète par PBKDF2-SHA-256. La phrase n'est jamais stockée ;
// si elle est perdue, les données chiffrées sont irrécupérables.

const ITERATIONS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function disponible() {
  return !!(globalThis.crypto && crypto.subtle);
}

export async function deriverCle(phrase, sel, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(phrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function nouvelleCle(phrase) {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  return { cle: await deriverCle(phrase, sel), sel: b64(sel), iterations: ITERATIONS };
}

export async function chiffrer(objet, { cle, sel, iterations }) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const donnees = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, enc.encode(JSON.stringify(objet)));
  return { format: 'procivil-chiffre', version: 1, algo: 'AES-GCM-256/PBKDF2-SHA256', iterations, sel, iv: b64(iv), donnees: b64(donnees) };
}

export async function dechiffrer(enveloppe, phrase) {
  const sel = deb64(enveloppe.sel);
  const cle = await deriverCle(phrase, sel, enveloppe.iterations || ITERATIONS);
  try {
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deb64(enveloppe.iv) }, cle, deb64(enveloppe.donnees));
    return { objet: JSON.parse(dec.decode(clair)), session: { cle, sel: enveloppe.sel, iterations: enveloppe.iterations || ITERATIONS } };
  } catch {
    throw new Error('Phrase secrète incorrecte ou fichier altéré.');
  }
}
