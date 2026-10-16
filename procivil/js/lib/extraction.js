// Extraction d'informations clés dans le texte d'un acte, par expressions
// régulières, entièrement dans le navigateur. Chaque champ retourne
// { valeur, extrait, confiance } : l'utilisateur doit toujours valider.
import { fromYMD, estDateISO, NOMS_MOIS } from './dates.js';

const sansAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const UNITES = {
  un: 1, premier: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, 'dix-sept': 17, 'dix-huit': 18,
  'dix-neuf': 19, vingt: 20, trente: 30,
};

// « vingt-et-un », « trente et un », « dix-huit » → nombre (1 à 31)
function jourEnLettres(txt) {
  const t = sansAccents(txt.toLowerCase()).replace(/\s+et\s+|-et-/g, '-').trim();
  if (UNITES[t] !== undefined) return UNITES[t];
  const [d, u] = t.split('-');
  if ((d === 'vingt' || d === 'trente') && u) {
    const r = UNITES[d] + (UNITES[u] ?? NaN);
    return r <= 31 ? r : NaN;
  }
  return NaN;
}

// « deux mille vingt-six » → 2026
function anneeEnLettres(txt) {
  const t = sansAccents(txt.toLowerCase()).replace(/\s+et\s+/g, '-').trim();
  const m = /^deux mille(?: (.+))?$/.exec(t);
  if (!m) return NaN;
  if (!m[1]) return 2000;
  const reste = m[1].replace(/\s+/g, '-');
  const n = jourEnLettres(reste);
  return Number.isNaN(n) ? NaN : 2000 + n;
}

const MOIS_RE = NOMS_MOIS.map((m) => sansAccents(m)).join('|');

function trouverDates(texte) {
  const t = sansAccents(texte);
  const out = [];
  const pousser = (iso, index, longueur) => {
    if (iso && estDateISO(iso)) out.push({ iso, index, contexte: texte.slice(Math.max(0, index - 90), index + longueur + 20) });
  };
  let m;
  const reNum = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})\b/g;
  while ((m = reNum.exec(t))) {
    let a = Number(m[3]); if (a < 100) a += 2000;
    const iso = fromYMD(a, Number(m[2]), Number(m[1]));
    if (Number(iso.slice(8)) === Number(m[1]) && Number(m[2]) <= 12) pousser(iso, m.index, m[0].length);
  }
  const reTxt = new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${MOIS_RE})\\s+(\\d{4})\\b`, 'gi');
  while ((m = reTxt.exec(t))) {
    const mois = MOIS_RE.split('|').indexOf(m[2].toLowerCase()) + 1;
    const iso = fromYMD(Number(m[3]), mois, Number(m[1]));
    if (Number(iso.slice(8)) === Number(m[1])) pousser(iso, m.index, m[0].length);
  }
  // Dates en toutes lettres, fréquentes dans les actes de commissaire de justice :
  // « L'an deux mille vingt-six, le trois mars »
  const reLettres = new RegExp(`l'an\\s+(deux mille(?:[\\s-][a-z-]+){0,3}?)\\s*,?\\s*(?:et\\s+)?le\\s+([a-z-]+(?:\\s+et\\s+un)?)\\s+(${MOIS_RE})`, 'gi');
  while ((m = reLettres.exec(t))) {
    const a = anneeEnLettres(m[1]);
    const j = jourEnLettres(m[2]);
    const mois = MOIS_RE.split('|').indexOf(m[3].toLowerCase()) + 1;
    if (!Number.isNaN(a) && !Number.isNaN(j)) pousser(fromYMD(a, mois, j), m.index, m[0].length);
  }
  return out.sort((x, y) => x.index - y.index);
}

const NATURES = [
  { id: 'signification_ip', re: /injonction de payer/i, poids: 5 },
  { id: 'signification_ordonnance_refere', re: /signifi\w*[\s\S]{0,200}ordonnance de r[ée]f[ée]r[ée]|ordonnance de r[ée]f[ée]r[ée][\s\S]{0,200}signifi/i, poids: 5 },
  { id: 'signification_arret', re: /signifi\w*[\s\S]{0,200}\barr[êe]t\b|\barr[êe]t\b[\s\S]{0,120}signifi/i, poids: 4 },
  { id: 'signification_jugement', re: /signification d'un jugement|signifi\w*[\s\S]{0,200}jugement|jugement[\s\S]{0,200}signifi/i, poids: 4 },
  { id: 'declaration_appel', re: /d[ée]claration d'appel/i, poids: 3 },
  { id: 'pv_saisie_attribution', re: /proc[èe]s-verbal de saisie-attribution/i, poids: 4 },
  { id: 'denonciation_saisie', re: /d[ée]nonciation de (la )?saisie/i, poids: 4 },
  { id: 'avis_fixation', re: /avis de fixation|bref d[ée]lai/i, poids: 2 },
  { id: 'assignation', re: /\bassignation\b|\bassigne\b|\bdonne assignation\b|\bassign[ée] [àa] compara[iî]tre/i, poids: 3 },
  { id: 'notification_jugement_greffe', re: /notification (du|d'un) jugement|lettre recommand[ée]e[\s\S]{0,120}greffe/i, poids: 2 },
];

const JURIDICTIONS = "tribunal judiciaire|tribunal de commerce|tribunal des activit[ée]s [ée]conomiques|tribunal mixte de commerce|conseil de prud'?hommes|cour d'appel|tribunal de proximit[ée]|juge des contentieux de la protection|juge de l'ex[ée]cution|tribunal paritaire des baux ruraux|p[ôo]le social du tribunal judiciaire|chambre commerciale du tribunal judiciaire";

export function extraireInformations(texteBrut) {
  const texte = (texteBrut || '')
    .replace(/ | /g, ' ')
    .replace(/[’`]/g, "'")
    .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl')
    .replace(/[ \t]+/g, ' ');
  const r = { avertissements: [] };

  // Nature de l'acte
  let best = null;
  for (const n of NATURES) {
    const m = n.re.exec(texte);
    if (m && (!best || n.poids > best.poids)) best = { ...n, m };
  }
  if (best) r.nature = { valeur: best.id, extrait: texte.slice(Math.max(0, best.m.index - 30), best.m.index + 80), confiance: best.poids >= 4 ? 'moyenne' : 'faible' };

  // Dates classées selon leur contexte
  const dates = trouverDates(texte);
  r.dates = dates.map((d) => ({ valeur: d.iso, extrait: d.contexte.trim() }));
  const cherche = (re) => dates.find((d) => re.test(sansAccents(d.contexte.slice(-140)).toLowerCase()));
  const audience = cherche(/audience|comparaitre|a l'audience du/);
  const decision = cherche(/rendu le|jugement du|ordonnance du|arret du|en date du/);
  const acte = cherche(/l'an |signifie|signification|delivre|fait le|le present acte/) || dates.find((d) => d !== audience && d !== decision);
  if (acte) r.dateActe = { valeur: acte.iso, extrait: acte.contexte.trim(), confiance: 'moyenne' };
  if (audience) r.dateAudience = { valeur: audience.iso, extrait: audience.contexte.trim(), confiance: 'moyenne' };
  if (decision && decision !== acte) r.dateDecision = { valeur: decision.iso, extrait: decision.contexte.trim(), confiance: 'moyenne' };

  // Juridiction mentionnée
  const reJ = new RegExp(`(${JURIDICTIONS})\\s+(?:de |d'|du |des )\\s*([A-ZÉÈÂÎÔ][\\wÀ-ÿ'\\-]+(?:[\\s-](?:sur|en|lès|les|le|la|de|du|d')?[\\s-]?[A-ZÉÈÂÎÔ][\\wÀ-ÿ'\\-]+)*)`, 'i');
  const mj = reJ.exec(texte);
  if (mj) r.juridiction = { valeur: `${mj[1].charAt(0).toUpperCase()}${mj[1].slice(1).toLowerCase()} de ${mj[2]}`.replace(/ de ([AEIOUÉ])/, " d'$1"), extrait: mj[0], confiance: 'moyenne' };

  // Parties
  const mReq = /(?:à la requête de|a la requete de|pour)\s*:?\s*([^,\n]{3,80})/i.exec(texte);
  if (mReq) r.requerant = { valeur: mReq[1].trim(), extrait: mReq[0], confiance: 'faible' };
  const mDest = /(?:signifi[ée]e?\s+à|donn[ée] assignation à|à)\s*:?\s*((?:monsieur|madame|m\.|mme|la soci[ée]t[ée]|la sci|la sas|la sarl|la sa)\s+[^,\n]{2,80})/i.exec(texte);
  if (mDest) r.destinataire = { valeur: mDest[1].trim(), extrait: mDest[0], confiance: 'faible' };

  // Domicile (demeurant, domicilié, siège social) : adresse + code postal + commune.
  // On retient en priorité l'adresse qui suit le destinataire de l'acte (défendeur).
  const reD = /(demeurant|domicili[ée]e?|ayant (?:son )?si[èe]ge(?: social)?|si[èe]ge social)\s*(?:au|à|:)?\s*([^\n]{0,120}?)\b(\d{5})\s+([A-ZÉÈ][A-Za-zÀ-ÿ'\- ]{1,40}?)(?=[,.;\n)]|$| \()/g;
  const domiciles = [...texte.matchAll(reD)];
  const idxDest = mDest ? mDest.index : -1;
  const md = domiciles.find((x) => x.index > idxDest) || domiciles[domiciles.length - 1];
  if (md) {
    r.domicile = {
      valeur: `${md[2].trim().replace(/,$/, '')} ${md[3]} ${md[4].trim()}`.trim(),
      codePostal: md[3], commune: md[4].trim(), extrait: md[0], confiance: mDest ? 'moyenne' : 'faible',
    };
  }

  // Montant (utile pour la compétence matérielle)
  const mMont = /(\d{1,3}(?:[ .]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:€|euros?\b)/i.exec(texte);
  if (mMont) r.montant = { valeur: Number(mMont[1].replace(/[ .]/g, '').replace(',', '.')), extrait: mMont[0], confiance: 'faible' };

  const mRG = /\bR\.?\s?G\.?\s*(?:n°|no|numéro)?\s*:?\s*([0-9]{2}\/[0-9]{3,6}|[0-9A-Z][0-9A-Z/\-]{3,})/i.exec(texte);
  if (mRG) r.rg = { valeur: mRG[1], extrait: mRG[0], confiance: 'moyenne' };

  if (!texte.trim()) r.avertissements.push('Aucun texte exploitable : document vide ou image non lisible.');
  else if (!r.dateActe) r.avertissements.push("Aucune date d'acte reconnue : saisissez-la manuellement.");
  return r;
}
