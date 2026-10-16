// Export des échéances au format iCalendar (RFC 5545), importable dans
// Outlook, Google Agenda ou Apple Calendrier.
import { ajouterJours } from './dates.js';

const echapper = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Repli des lignes à 75 octets environ (RFC 5545, 3.1).
function plier(ligne) {
  const out = [];
  let reste = ligne;
  while (reste.length > 73) { out.push(reste.slice(0, 73)); reste = ` ${reste.slice(73)}`; }
  out.push(reste);
  return out.join('\r\n');
}

export function genererICS(affaires, { rappelJours = 3, horodatage = new Date() } = {}) {
  const stamp = horodatage.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ProCivil MVP//Delais de procedure//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const a of affaires) {
    for (const d of a.delais) {
      if (d.statut === 'accompli' || !d.echeance) continue;
      const debut = d.echeance.replace(/-/g, '');
      const fin = ajouterJours(d.echeance, 1).replace(/-/g, '');
      lignes.push('BEGIN:VEVENT',
        `UID:${d.id}@procivil`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${debut}`,
        `DTEND;VALUE=DATE:${fin}`,
        plier(`SUMMARY:${echapper(`⚠ ${d.libelle} — ${a.nom}`)}`),
        plier(`DESCRIPTION:${echapper(`Échéance à 24 h. ${d.article}. Affaire : ${a.nom}${a.rg ? ` (RG ${a.rg})` : ''}. Calcul indicatif : à vérifier.`)}`),
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${echapper(d.libelle)}`, `TRIGGER:-P${rappelJours}D`, 'END:VALARM',
        'END:VEVENT');
    }
  }
  lignes.push('END:VCALENDAR');
  return lignes.join('\r\n');
}
