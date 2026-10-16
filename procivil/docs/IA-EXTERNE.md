# Analyse des documents par IA externe (facultatif)

Par défaut, l'outil n'envoie **rien** à l'extérieur. Le texte des actes est extrait et analysé dans le navigateur, avec PDF.js, Tesseract.js et des expressions régulières. Cette page explique comment ajouter une IA **sans exposer de clé API**, et ce que cela implique.

## Pourquoi un proxy

Un site statique ne peut pas garder de secret : tout fichier publié sur Free est lisible par n'importe qui. La clé API doit donc vivre ailleurs, dans une petite fonction serverless qui :

1. reçoit le **texte** extrait (jamais le fichier) ;
2. vérifie l'origine (`ORIGINE_AUTORISEE`) et un jeton partagé (`JETON_ACCES`) ;
3. appelle l'API d'IA avec la clé stockée en **secret** ;
4. renvoie un JSON structuré (dates, parties, juridiction), que l'utilisateur doit ensuite valider.

```
Navigateur ──texte + jeton──► Cloudflare Worker (clé API en secret) ──► API Anthropic
          ◄──JSON structuré──                                       ◄──
```

## Déploiement sur Cloudflare Workers (offre gratuite)

1. Créez un compte Cloudflare, puis allez dans Workers & Pages > Create > Worker.
2. Collez le contenu de `proxy/cloudflare-worker.js`, puis déployez. Le code n'utilise que `fetch()` : il n'y a ni dépendance ni compilation.
3. Dans Settings > Variables and Secrets, définissez :
   - `ANTHROPIC_API_KEY` (**secret**) : votre clé API ;
   - `JETON_ACCES` (**secret**) : une longue chaîne aléatoire ;
   - `ORIGINE_AUTORISEE` (variable) : `https://moncabinet.free.fr`, sans barre finale.
4. Dans l'outil, ouvrez Paramètres > Analyse par IA externe, puis renseignez l'URL du Worker et le jeton.
5. Au dépôt d'un document, un bouton « Compléter avec l'IA externe » apparaît. **Chaque envoi est confirmé.**

Le Worker utilise le modèle `claude-opus-5-5` avec une sortie JSON contrainte par un schéma. Il active le repli automatique côté serveur (`fallbacks: "default"`) si une requête est refusée par les filtres du modèle. Il ne journalise ni le texte ni la réponse.

## Risques à évaluer avant activation

- **Secret professionnel** (art. 66-5 de la loi du 31 décembre 1971, RIN art. 2) : le texte d'un acte contient des données couvertes par le secret. Il transite par Cloudflare puis par le fournisseur d'IA. L'activation relève de la responsabilité de l'avocat.
- **RGPD** : le fournisseur d'IA et Cloudflare sont des sous-traitants (art. 28). Il faut un contrat de sous-traitance (DPA), des informations sur la localisation (transferts hors UE et garanties applicables), sur la durée de conservation et, si possible, une option de conservation nulle. Il faut aussi mettre à jour le registre des traitements et informer les clients.
- **Jeton dans le navigateur** : le jeton d'accès au proxy est stocké localement. Il limite l'usage du proxy, mais ne protège pas contre quelqu'un qui a accès au poste. Prévoyez une limite de dépenses sur la clé API et, si possible, une limitation de débit dans Cloudflare.
- **Fiabilité** : une IA peut se tromper ou inventer une date. Le résultat ne fait que **pré-remplir** le formulaire, et la validation humaine reste obligatoire.

Une alternative plus protectrice consiste à pseudonymiser le texte avant envoi (remplacer noms et adresses par des jetons dans le navigateur). Elle n'est pas implémentée dans cette maquette.
