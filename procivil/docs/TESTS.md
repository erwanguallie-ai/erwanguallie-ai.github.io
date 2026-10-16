# 4. Jeu de tests

**79 tests automatisés**, tous réussis. Ils tournent de deux façons :

- **en ligne de commande** : `node tests/run-node.mjs` (Node 18 ou plus récent, code de sortie 1 en cas d'échec) ;
- **dans le navigateur** : ouvrir `tests.html` sur le site publié. Les tests portent alors sur les fichiers JSON réellement en ligne, ce qui permet de vérifier une modification des règles après mise en ligne.

Les cas et les résultats attendus sont définis une seule fois, dans `tests/cas.js`. Ils ont été calculés à la main à partir des textes et du calendrier, indépendamment du code.

## 4.1 Calcul des délais (27 cas)

Tous les cas sont en métropole, hors Alsace-Moselle, sauf mention contraire.

| # | Cas | Type | Départ | Contexte | Attendu | Raisonnement |
|---|---|---|---|---|---|---|
| 1 | Appel (1 mois) expirant un samedi : prorogation au lundi | `appel_contentieux` | 15/01/2025 | — | **17/02/2025** | 15/01 + 1 mois = samedi 15/02 → lundi 17/02 (art. 641 et 642) |
| 2 | Fin de mois : 31 janvier + 1 mois (année non bissextile) | `appel_contentieux` | 31/01/2025 | — | **28/02/2025** | Pas de 31 février : dernier jour du mois, vendredi 28/02 (art. 641 al. 2) |
| 3 | Année bissextile : 31 janvier 2024 + 1 mois | `appel_contentieux` | 31/01/2024 | — | **29/02/2024** | Jeudi 29/02/2024 |
| 4 | Pourvoi (2 mois) depuis le 30 décembre 2023 (bissextile) | `pourvoi` | 30/12/2023 | — | **29/02/2024** | Pas de 30 février : dernier jour du mois, jeudi 29/02/2024 (art. 612 et 641) |
| 5 | Référé (15 jours) expirant le lundi de Pâques | `appel_refere` | 06/04/2025 | — | **22/04/2025** | Le 15e jour est le lundi 21/04/2025 (lundi de Pâques) → mardi 22/04 |
| 6 | Appel expirant le 11 novembre (mardi férié) | `appel_contentieux` | 11/10/2025 | — | **12/11/2025** | 11/11/2025 férié → mercredi 12/11 |
| 7 | Samedi, dimanche puis lundi de Pentecôte | `appel_refere` | 23/05/2025 | — | **10/06/2025** | Samedi 07/06, dimanche 08/06, lundi de Pentecôte 09/06 → mardi 10/06/2025 |
| 8 | 26 décembre en métropole (jour ouvrable) | `appel_contentieux` | 26/11/2025 | — | **26/12/2025** | Vendredi 26/12/2025, ouvrable hors Alsace-Moselle |
| 9 | 26 décembre en Alsace-Moselle (férié local) | `appel_contentieux` | 26/11/2025 | fériés alsace-moselle | **29/12/2025** | Saint-Étienne férié (L. 3134-13 C. trav.), puis week-end → lundi 29/12/2025 |
| 10 | Vendredi saint en Alsace-Moselle puis week-end et lundi de Pâques | `appel_refere` | 03/04/2025 | fériés alsace-moselle | **22/04/2025** | Vendredi saint 18/04, samedi, dimanche, lundi de Pâques 21/04 → mardi 22/04/2025 |
| 11 | Même délai en métropole : le Vendredi saint est ouvrable | `appel_refere` | 03/04/2025 | — | **18/04/2025** | Vendredi 18/04/2025 |
| 12 | Délai de distance : partie demeurant à La Réunion, juridiction en métropole | `appel_contentieux` | 10/03/2025 | résidence reunion | **12/05/2025** | 1 mois + 1 mois (art. 643, 1°) = samedi 10/05 → lundi 12/05/2025 |
| 13 | Distance étranger en fin de mois : divergence des méthodes, la plus proche retenue | `appel_contentieux` | 31/01/2025 | résidence etranger | **28/04/2025** | Délai unique (3 mois) : 30/04 ; délais successifs : 28/02 + 2 mois = 28/04 → 28/04/2025 retenu |
| 14 | Art. 644 : juridiction à La Réunion, partie en métropole | `appel_contentieux` | 03/03/2025 | juridiction reunion, fériés reunion | **05/05/2025** | 1 + 1 mois = samedi 03/05 → lundi 05/05/2025 |
| 15 | Art. 647 : notification à personne sur place, pas d'augmentation | `appel_contentieux` | 03/03/2025 | résidence etranger, art. 647 | **03/04/2025** | Jeudi 03/04/2025 |
| 16 | Constitution du défendeur (15 jours) expirant un samedi | `constitution_defendeur` | 13/02/2026 | — | **02/03/2026** | Samedi 28/02/2026 → lundi 02/03/2026 (art. 755 et 642) |
| 17 | Délai à rebours (remise de l'assignation) tombant un dimanche | `remise_assignation` | 16/03/2026 | — | **27/02/2026** | Audience lundi 16/03 − 15 jours = dimanche 01/03 → vendredi 27/02/2026 par prudence |
| 18 | Prescription (12 mois) : pas de prorogation de l'art. 642 | `contestation_licenciement` | 15/03/2025 | — | **15/03/2026** | Dimanche 15/03/2026, avec avertissement |
| 19 | Déclaration de créances : créancier à l'étranger (2 + 2 mois) | `declaration_creances` | 10/01/2026 | résidence etranger | **11/05/2026** | Dimanche 10/05/2026 → lundi 11/05 (R. 622-24 C. com.) |
| 20 | Péremption (2 ans) depuis un 29 février | `peremption` | 29/02/2024 | — | **02/03/2026** | Pas de 29/02/2026 : samedi 28/02 → lundi 02/03/2026 |
| 21 | Lundi de Pentecôte 2026 | `appel_refere` | 10/05/2026 | — | **26/05/2026** | Lundi 25/05/2026 (Pentecôte) → mardi 26/05 |
| 22 | Interruption par une demande d'aide juridictionnelle | `appel_contentieux` | 05/01/2026 | AJ | **02/04/2026** | Nouveau délai d'un mois à compter du 02/03 → jeudi 02/04/2026 |
| 23 | Demande d'aide juridictionnelle tardive : sans effet | `appel_contentieux` | 05/01/2026 | AJ | **05/02/2026** | Délai initial expiré le jeudi 05/02/2026 |
| 24 | Jour chômé saisi par l'avocat | `appel_contentieux` | 03/06/2026 | jour chômé | **06/07/2026** | Vendredi 03/07 chômé, puis week-end → lundi 06/07/2026 |
| 25 | Guadeloupe : 27 mai férié (abolition de l'esclavage) | `appel_refere` | 12/05/2026 | résidence guadeloupe, juridiction guadeloupe, fériés guadeloupe | **28/05/2026** | Mercredi 27/05/2026 férié → jeudi 28/05 |
| 26 | Délai personnalisé « 2 mois et 10 jours » : mois puis jours | `libre` | 31/01/2026 | {mois:2,jours:10} | **10/04/2026** | 31/01 + 2 mois = 31/03, + 10 jours = vendredi 10/04/2026 (art. 641 al. 3) |
| 27 | Changement d'année : 15 jours depuis le 20 décembre 2025 | `appel_refere` | 20/12/2025 | — | **05/01/2026** | Le 15e jour est le dimanche 04/01/2026 → lundi 05/01/2026 |

Les cas limites demandés sont couverts :

| Cas limite | Tests |
|---|---|
| Fin de mois | 2, 4, 13, 20, 26 |
| Jour férié | 5, 6, 7, 9, 10, 21, 25 |
| Délai de distance | 12, 13, 14, 15, 19 |
| Année bissextile | 3, 4, 20 |
| Changement d'année | 27 |
| Délai à rebours | 17 |
| Prescription sans prorogation | 18 |
| Interruption (aide juridictionnelle) | 22, 23 |

## 4.2 Jours fériés et dates (11 tests)

- Date de Pâques en 2000, 2024, 2025, 2026, 2027 et 2038 (algorithme de Meeus, Jones et Butcher).
- L'Ascension 2026 (14 mai) est non ouvrable ; le lundi 4 mai 2026 est ouvrable.
- 31 août + 1 mois = 30 septembre.
- Lecture de « 1er mars 2026 » et de « 05/03/26 ».
- Refus du 31/02/2026.

## 4.3 Niveaux d'alerte, seuils et tri (29 tests)

| Test | Entrée | Attendu |
|---|---|---|
| Seuils par défaut 3 / 7 | −5 j, −1 j | expiré |
| | 0 j, 3 j | rouge |
| | 4 j, 7 j | orange |
| | 8 j | normal |
| | aucun délai | « Aucun délai en cours » |
| Seuils modifiés 5 / 10 | 5 j | rouge |
| | 6 j, 10 j | orange |
| | 11 j | normal |
| Changement de seuils | 4 j avec 3 / 7, puis avec 5 / 10 | passe d'orange à rouge |
| Contrôle de cohérence | 3 / 7 et 0 / 1 | acceptés |
| | 5 / 5 (orange égal au rouge) | **refusé** |
| | 6 / 4 (orange inférieur au rouge) | **refusé**, message « doit être strictement supérieur » |
| | −1 / 7, 2,5 / 7, vide / 7, 3 / 400 | refusés |
| Tri par priorité | 7 affaires, dont une expirée, deux à égalité, une sans délai et une dont le seul délai est accompli | ordre `B E C G A F D` : expirée en tête, puis échéances croissantes, égalités par ordre alphabétique, affaires sans délai en dernier |
| Délai prioritaire | affaire avec deux délais | le plus proche est retenu ; un délai accompli est ignoré |
| Libellés | 0 / 1 / 2 / −3 jours | « Expire aujourd'hui à 24 h », « Expire demain à 24 h », « Expire dans 2 jours », « Expiré depuis 3 jours » |

## 4.4 Extraction et compétence (12 tests)

- **Extraction d'une signification** : nature de l'acte, date, juridiction et code postal du destinataire.
- **Compétence** :
  - contrat de 4 000 € : TJ, avec le préalable amiable de l'art. 750-1 ;
  - demande de 15 000 € : représentation obligatoire (art. 760) ;
  - litige né d'un contrat de travail : conseil de prud'hommes (art. R. 1412-1 C. trav.) ;
  - agriculteur en difficulté : TJ, ou TAE dans les ressorts de l'expérimentation ;
  - responsabilité délictuelle : options de l'art. 46 ;
  - Lyon 3e arrondissement : TJ de Lyon ;
  - Strasbourg, matière commerciale : chambre commerciale du TJ ;
  - commune hors échantillon : renvoi vers l'annuaire officiel.

## 4.5 Tests de bout en bout (navigateur Chromium, hors jeu automatisé)

Ces parcours ont été vérifiés dans un navigateur réel pendant le développement :

- **Seuils** : la saisie 6 / 4 est refusée avec un message. Avec 5 / 10, les pastilles du tableau de bord changent. « Rétablir » remet 3 / 7.
- **Fiche** : ajout d'un acte avec ses délais suggérés. Une modification de date recalcule le pourvoi (30/12/2026 → 01/02/2027).
- **Compétence** : le parcours civil donne le TJ de Lyon et la cour d'appel de Lyon. Une commune hors échantillon (Colmar) renvoie vers l'annuaire.
- **Document** : un PDF texte et une image (OCR Tesseract) donnent les mêmes champs. L'enregistrement est refusé sans la case de validation. Après validation, l'affaire est créée avec son délai d'appel, et les jours fériés d'Alsace-Moselle sont déduits de « Tribunal judiciaire de Strasbourg ».
- **Mise en page** : aucun débordement horizontal à 390 px et à 1280 px, en thème clair comme en thème sombre ; aucune erreur dans la console.
