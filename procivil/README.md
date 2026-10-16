# ProCivil : suivi d'affaires et délais de procédure civile

Maquette fonctionnelle (MVP) d'un outil d'aide aux avocats en procédure civile française. Le site est 100 % statique, conçu pour les pages perso Free. Les données restent dans le navigateur.

> **Outil d'aide.** Les calculs ne remplacent pas la vérification par le professionnel des textes en vigueur, du point de départ exact du délai et des circonstances de l'espèce. Les règles marquées 🔎 « à vérifier » ont pu changer récemment.

## Démarrer

```bash
cd procivil
python3 -m http.server 8000      # puis ouvrir http://localhost:8000
node tests/run-node.mjs          # 79 tests (ou http://localhost:8000/tests.html)
```

Au premier lancement, quatre affaires fictives sont créées : une **expirée**, une **urgente** (rouge), une **à surveiller** (orange) et une **dans les temps**. Leurs dates sont recalculées par rapport à la date du jour.

## Fonctionnalités

| Domaine | Contenu |
|---|---|
| **Tableau de bord** | Affaires triées par échéance ; alertes rouge, orange et expiré (couleur, icône et texte) ; filtre ; rappel de sauvegarde |
| **Fiche d'affaire** | Frise chronologique (horizontale ou verticale selon l'écran) avec repère « aujourd'hui » ; calcul pas à pas pour chaque étape ; ajout et modification d'actes avec recalcul ; export agenda `.ics` |
| **Paramètres** | Seuils réglables, avec contrôle orange > rouge ; jours chômés ; export et import JSON ; chiffrement local ; IA facultative |
| **Calculateur** | Art. 640 à 642, 643, 644 et 647 CPC ; Pâques, Ascension, Pentecôte ; jours fériés d'Alsace-Moselle et des DROM ; interruption par une demande d'aide juridictionnelle ; délais à rebours ; délais personnalisés |
| **Compétence** | Arbre de décision matériel et territorial (art. 42, 43, 44, 45, 46 CPC et règles spéciales), préalable amiable, représentation obligatoire, juridiction précise par commune (échantillon), enregistrement dans la fiche |
| **Documents** | PDF texte ou scanné et photos : PDF.js et OCR Tesseract **dans le navigateur** ; repérage des dates, des parties, de la juridiction et du domicile ; validation obligatoire avant enregistrement |

## Documentation

1. [Architecture, modèle de données, choix techniques](docs/ARCHITECTURE.md)
2. [Maquette des écrans](docs/MAQUETTE.md)
3. Code : ce dépôt ; règles juridiques dans `data/*.json`
4. [Jeu de tests](docs/TESTS.md)
5. [Mise en ligne sur les pages perso Free](docs/DEPLOIEMENT.md)
6. [Limites et pistes d'évolution](docs/LIMITES.md)
7. [IA externe facultative](docs/IA-EXTERNE.md)

## Licences des composants tiers

- **PDF.js** (Apache-2.0) : `vendor/pdfjs/LICENSE`.
- **Tesseract.js** (Apache-2.0) : `vendor/tesseract/LICENSE.md`.
- **Modèle `fra.traineddata`** (tessdata_best, Apache-2.0).
- **Communes** : référentiel `@etalab/decoupage-administratif` (Licence Ouverte 2.0, code officiel géographique de l'INSEE).
