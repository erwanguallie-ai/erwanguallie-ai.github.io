# 6. Limites et pistes d'évolution

## 6.1 Limites juridiques (à lire avant tout usage réel)

**Règles signalées « à vérifier »** (`"verifie": false` dans les JSON). L'outil les affiche avec 🔎. Je n'ai pas pu confirmer leur texte en vigueur à la date du 16/10/2026 ; je ne les ai donc pas présentées comme certaines.

- **Appel avec représentation obligatoire** : les art. 902, 906-1, 906-2, 908 à 910, 911-2 et 913-8 (ancien 916) sont dans leur rédaction issue du décret n° 2023-1391, applicable aux instances d'appel introduites depuis le 1er septembre 2024. Les sources consultées confirment :
  - le délai de 20 jours pour signifier la déclaration d'appel à bref délai (au lieu de 10) ;
  - le délai de 2 mois pour conclure à bref délai (au lieu d'un mois).

  Restent à vérifier sur Légifrance : le maintien des 3 mois en procédure ordinaire, le régime de l'art. 902, la numérotation du déféré et le délai de distance de l'art. 911-2. Le président de chambre peut désormais aménager ces délais : l'outil ne le sait pas.
- **Art. 754 (remise de l'assignation au greffe)** : la règle des 15 jours avant l'audience est modélisée. Les autres délais butoirs de cet article ne le sont pas. La prorogation de l'art. 642 ne vaut pas pour les délais « à rebours » : l'outil recule l'échéance au jour ouvrable précédent, par prudence.
- **Art. 750-1 (préalable amiable)** : rétabli par le décret n° 2023-357. Le livre V du CPC a été refondu par le décret n° 2025-660 du 18 juillet 2025, entré en vigueur le 1er septembre 2025 ; la numérotation est à contrôler.
- **Articles du COJ** sur le juge des contentieux de la protection (L. 213-4-2 et suivants) et sur la compétence exclusive du TJ (R. 211-3-26) : numérotation à vérifier.
- **Tribunaux des activités économiques** : 12 sites (Avignon, Auxerre, Le Havre, Le Mans, Limoges, Lyon, Marseille, Nancy, Nanterre, Paris, Saint-Brieuc, Versailles), du 1er janvier 2025 au 31 décembre 2028, selon les sources consultées (Service-public, ministère de la Justice). Le périmètre exact de leur compétence, au-delà des procédures collectives, n'est pas modélisé.
- **Péremption (art. 386)** : la jurisprudence de 2024 sur l'absence de péremption une fois les parties ayant conclu n'est signalée que par un avertissement.

**Méthodes prudentes** : quand plusieurs lectures sont possibles, l'outil retient l'échéance la plus proche et le signale. Trois cas :

- **Délai de distance en fin de mois** : un délai unique et deux délais successifs donnent des dates différentes ; l'outil retient la plus proche.
- **Délais à rebours** : l'échéance est reculée au jour ouvrable précédent au lieu d'être prorogée.
- **Prescriptions** : pas de prorogation de l'art. 642.

**Non modélisé** :

- causes de suspension ou d'interruption de la prescription (art. 2233 et suivants C. civ.) ;
- délais de la procédure participative et de la médiation ;
- calendriers de procédure (à saisir en « délai personnalisé » avec date imposée) ;
- délais propres aux procédures sans représentation obligatoire devant la cour ;
- règlement Bruxelles I bis et compétence internationale ;
- clauses attributives (seulement mentionnées) ;
- jours fériés du Pacifique (à saisir comme jours chômés) ;
- **point de départ réel** du délai : signification à partie ou à avocat, date de réception d'une lettre recommandée (art. 668), notification électronique (art. 748-1 et suivants), vices de la notification. L'avocat le choisit lui-même.

**Correspondance commune → juridiction** : l'échantillon couvre 33 villes, saisies à la main et à vérifier. Le jeu officiel n'était pas accessible depuis l'environnement de développement. Le script `tools/build-juridictions.py` permet de l'intégrer. Des incohérences ont été signalées sur certaines versions de ce jeu.

**Extraction de documents** : elle repose sur des expressions régulières et produit des faux positifs. Le risque est plus élevé sur un OCR de photo de mauvaise qualité, notamment pour la confusion 1/7 et 0/8 dans les dates. La validation par l'utilisateur est obligatoire et ne doit pas être une formalité.

## 6.2 Limites techniques

- **Données liées à un navigateur, sur un poste** : il n'y a ni synchronisation ni partage dans le cabinet. Les données sont perdues si l'on efface les données du site et qu'aucune sauvegarde n'existe.
- **Aucune notification** quand l'onglet est fermé : l'alerte n'existe qu'à l'ouverture du tableau de bord. L'export `.ics` compense en partie, avec un rappel 3 jours avant dans l'agenda.
- **localStorage** : environ 5 Mo par site. Les documents ne sont pas conservés.
- **Chiffrement** : il exige HTTPS. Une phrase secrète oubliée rend les données irrécupérables.
- **OCR** : environ 13 Mo de fichiers et quelques secondes par page sur un poste récent. Les PDF sont limités à 20 pages et 25 Mo.
- **Démonstration** : les quatre affaires sont recalculées par rapport à la date du jour. Les jours où le calendrier rend un niveau impossible à atteindre (par exemple autour de Pâques pour un délai de 3 mois), une affaire peut apparaître d'un autre niveau que prévu, environ 3 jours par an.

## 6.3 Pistes d'évolution

| Piste | Mise en œuvre possible dans les contraintes de Free | Effort |
|---|---|---|
| **Notifications** | API Notifications + Service Worker et Periodic Background Sync (Chrome seulement, site installé) ; ou envoi d'e-mails par un service externe (Cloudflare Worker + Cron) à partir d'un export volontaire | Moyen |
| **Export agenda** | Déjà fait (`.ics` par affaire). Ajouter un export global et un abonnement (URL `.ics`, qui suppose un hébergement des données hors navigateur) | Faible |
| **Synchronisation entre appareils** | Fichier de sauvegarde chiffré déposé sur un stockage du cabinet (OneDrive, Nextcloud via WebDAV), ou petite base hébergée (Cloudflare D1, Supabase) avec chiffrement de bout en bout côté navigateur | Élevé |
| **Multi-utilisateurs (cabinet)** | Impose un vrai serveur et une authentification ; sort du cadre des pages perso | Élevé |
| **Mise à jour des règles** | Signature et versionnement de `delais.json` ; journal des changements ; avertissement quand une affaire a été calculée avec une version antérieure | Faible |
| **Jeu complet commune → juridiction** | Intégrer le CSV officiel (script fourni), avec découpage par département et chargement à la demande | Faible |
| **Calendrier de procédure** | Import des dates fixées par le juge de la mise en état, rappels associés | Moyen |
| **RPVA / e-barreau** | Pas d'API publique : import manuel des avis (copier-coller analysé par `extraction.js`) | Moyen |
| **Application installable (PWA)** | Manifeste + Service Worker : fonctionnement hors ligne et icône sur le bureau | Faible |
| **Stockage des pièces** | IndexedDB, chiffré, avec quota et purge | Moyen |
| **Validation juridique** | Relecture du catalogue par un praticien, cas de tests issus de décisions publiées (Cass. 2e civ.) | Indispensable avant usage réel |
