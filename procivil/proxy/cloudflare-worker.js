// Proxy facultatif pour l'analyse des documents par IA (Claude, API Anthropic).
// À déployer sur VOTRE compte Cloudflare Workers (offre gratuite) : la clé API
// reste dans les secrets du Worker et n'apparaît jamais dans le site statique.
//
// Écrit en fetch() brut, sans SDK, pour pouvoir être collé tel quel dans
// l'éditeur en ligne de Cloudflare (pas d'étape de compilation).
//
// Secrets / variables à définir dans le Worker :
//   ANTHROPIC_API_KEY  (secret)  clé API Anthropic
//   JETON_ACCES        (secret)  jeton partagé, saisi aussi dans Paramètres > IA
//   ORIGINE_AUTORISEE  (variable) ex. https://monsite.free.fr (CORS)
//
// Le Worker ne journalise ni le texte reçu ni la réponse.

const MODELE = 'claude-opus-5-5';
const TAILLE_MAX = 60000; // caractères de texte acceptés

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nature: { type: ['string', 'null'], description: "Un identifiant parmi : signification_jugement, notification_jugement_greffe, signification_ordonnance_refere, signification_ip, signification_arret, assignation, declaration_appel, avis_fixation, pv_saisie_attribution, denonciation_saisie, autre" },
    date_acte: { type: ['string', 'null'], description: "Date de l'acte (signification, délivrance), format AAAA-MM-JJ" },
    date_audience: { type: ['string', 'null'], description: "Date d'audience, format AAAA-MM-JJ" },
    date_decision: { type: ['string', 'null'], description: 'Date de la décision signifiée, format AAAA-MM-JJ' },
    juridiction: { type: ['string', 'null'] },
    demandeur: { type: ['string', 'null'], description: 'Requérant' },
    defendeur: { type: ['string', 'null'], description: "Destinataire de l'acte" },
    domicile_defendeur: { type: ['string', 'null'] },
    montant: { type: ['number', 'null'] },
  },
  required: ['nature', 'date_acte', 'date_audience', 'date_decision', 'juridiction', 'demandeur', 'defendeur', 'domicile_defendeur', 'montant'],
};

const CONSIGNE = "Tu extrais des informations d'un acte de procédure civile français. Réponds uniquement à partir du texte fourni. Si une information est absente ou ambiguë, renvoie null plutôt que de la deviner. Les dates écrites en toutes lettres doivent être converties au format AAAA-MM-JJ.";

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ORIGINE_AUTORISEE || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function json(corps, statut, env) {
  return new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(env) } });
}

export default {
  async fetch(requete, env) {
    if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (requete.method !== 'POST') return json({ erreur: 'Méthode non autorisée' }, 405, env);
    if (env.ORIGINE_AUTORISEE && requete.headers.get('Origin') !== env.ORIGINE_AUTORISEE) return json({ erreur: 'Origine refusée' }, 403, env);
    if (!env.JETON_ACCES || requete.headers.get('Authorization') !== `Bearer ${env.JETON_ACCES}`) return json({ erreur: 'Jeton invalide' }, 401, env);

    let texte;
    try { ({ texte } = await requete.json()); } catch { return json({ erreur: 'Corps JSON invalide' }, 400, env); }
    if (typeof texte !== 'string' || !texte.trim()) return json({ erreur: 'Texte manquant' }, 400, env);
    if (texte.length > TAILLE_MAX) return json({ erreur: 'Texte trop long' }, 413, env);

    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // Repli automatique sur un autre modèle si une requête est refusée par les filtres de sécurité.
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 4000,
        fallbacks: 'default',
        system: CONSIGNE,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: `Texte de l'acte :\n\n${texte}` }],
      }),
    });

    if (!reponse.ok) return json({ erreur: `API Anthropic : HTTP ${reponse.status}` }, 502, env);
    const message = await reponse.json();
    if (message.stop_reason === 'refusal') return json({ erreur: 'Requête refusée par le modèle' }, 422, env);
    if (message.stop_reason === 'max_tokens') return json({ erreur: 'Réponse tronquée' }, 502, env);
    const bloc = message.content.find((c) => c.type === 'text');
    try {
      return json(JSON.parse(bloc.text), 200, env);
    } catch {
      return json({ erreur: 'Réponse illisible' }, 502, env);
    }
  },
};
