# 2. Maquette visuelle

Principes communs :
- Ton sobre de cabinet : fond papier légèrement bleuté, encre bleu marine, titres en serif, texte en police système.
- Aucune police externe.
- Chaque niveau d'urgence associe **couleur + icône + texte**, jamais la couleur seule :
  - ⛔ « Expiré depuis 3 jours » ;
  - ⚠️ « Expire dans 2 jours » ;
  - ⏳ « Expire dans 6 jours » ;
  - 📅 « Expire dans 40 jours ».
- Mode sombre automatique.
- Navigation au clavier, focus visible, dialogues natifs `<dialog>`.

## Page 1 : tableau de bord (accueil)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ProCivil  DÉLAIS DE PROCÉDURE      Affaires  Calculateur  Compétence  Document  Paramètres │
├──────────────────────────────────────────────────────────────────────────────┤
│ Affaires en cours                                  [+ Nouvelle affaire] [⚙ Paramètres] │
│ Au vendredi 16 octobre 2026 · seuils : rouge ≤ 3 j, orange ≤ 7 j              │
│ ▌Outil d'aide : les calculs ne remplacent pas la vérification…               │
│ 💾 Aucune sauvegarde exportée… exporter une sauvegarde                        │
│ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐                                  │
│ │1 expiré ││1 urgent ││1 à surv.││1 autre  │   (compteurs, liseré coloré)     │
│ └─────────┘└─────────┘└─────────┘└─────────┘                                  │
│ [Filtrer : nom, partie, juridiction…            ] ☐ Afficher les clôturées    │
│ AFFAIRE              JURIDICTION        PROCHAIN DÉLAI       ÉCHÉANCE  JOURS  │
│▌SAS Alpha c/ Bêta    TAE de Paris       Appel référé         ̶1̶3̶/̶1̶0̶     ⛔ Expiré depuis 3 j │
│▌Martin c/ SARL BTP   TJ de Lyon         Appel (art. 538)     19/10     ⚠️ Expire dans 3 j  │
│▌Durand c/ Banque     CA de Colmar       Conclusions (908)    22/10     ⏳ Expire dans 6 j  │
│ Petit c/ Logistique  CPH de Lille       Appel prud'hommes    10/12     📅 Expire dans 55 j │
│ (affaires sans délai en cours : en bas de liste, « Aucun délai en cours »)   │
│ Légende : ⛔ … ⚠️ … ⏳ … 📅 …                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Tri** : de l'échéance la plus proche à la plus lointaine. Un délai expiré et non marqué comme accompli a une date passée, donc il reste en tête. Les affaires sans délai ferment la liste.
- **Ligne** : liseré gauche de la couleur du niveau. En rouge et en orange, le prochain délai et l'échéance passent aussi dans la couleur du niveau. Une échéance expirée est barrée. La pastille du dernier champ porte toujours une icône et un libellé explicite.
- **Mobile (< 46 rem)** : le tableau se replie en fiches empilées, avec les intitulés de colonnes repris au-dessus de chaque valeur.

## Page 2 : fiche d'une affaire

```
← Tableau de bord
SAS Alpha Distribution c/ SARL Bêta Logistique
Réf. cabinet 2025-140 · RG 25/R/0312
[Modifier l'affaire] [📄 Déposer un document] [⚖ Compétence] [📅 Export agenda]
▌Outil d'aide…
┌ Parties et juridiction ─────────────┐ ┌ Paramètres de calcul ────────────────┐
│ Demandeur  SAS Alpha                │ │ Siège          Métropole             │
│ Défendeur  SARL Bêta  CLIENT        │ │ Jours fériés   Métropole             │
│ Juridiction TAE de Paris            │ │ Résidence      France métropolitaine │
│   art. L. 721-3 C. com.             │ │ Seuils         rouge ≤ 3, orange ≤ 7 │
└─────────────────────────────────────┘ └──────────────────────────────────────┘
┌ Frise chronologique ─────────────────────────── [+ Ajouter un acte] [+ Ajouter un délai] ┐
│ ●────────────●─────────────◆──────────────┊───────────────◆─────────────── │
│ ACTE         ACTE          ÉCHÉANCE       ┊ Aujourd'hui   ÉCHÉANCE          │
│ 19/08/2026   28/09/2026    13/10/2026     ┊ 16/10/2026    …                 │
│ Assignation  Signification Appel référé   ┊               …                 │
│ en référé    ordonnance    15 j · art.490 ┊                                 │
│                            ⛔ Expiré       ┊                                 │
│ ─ Détail (clic sur une étape) ──────────────────────────────────────────── │
│ Appel d'une ordonnance de référé · 15 jours · art. 490 CPC · Irrecevabilité │
│ CALCUL PAS À PAS                                                            │
│ 1. [art. 640 et 641 al. 1] Point de départ : …le lundi 28 sept. Ne compte pas│
│ 2. [art. 641 al. 1] Le 15e jour est le mardi 13 octobre 2026.               │
│ 3. [art. 642 al. 1] Le délai expire le mardi 13 octobre 2026 à 24 heures.   │
│ ⚠️ Points de vigilance : …                                                  │
│ [✔ Marquer comme accompli] [Modifier les paramètres]                        │
└─────────────────────────────────────────────────────────────────────────────┘
┌ Délais ┐  tableau : délai, départ, échéance, état, [Détail] [✔] [Supprimer]
┌ Actes  ┐  tableau : date, acte, délais liés, [Modifier] [Supprimer]
┌ Notes  ┐
                                          [Clôturer l'affaire] [Supprimer l'affaire]
```

- **Repères de la frise** : rond pour un acte, losange pour une échéance, trait pointillé vertical pour « Aujourd'hui ». Le cadre d'une échéance reprend le code du tableau de bord : rouge plein, orange plein, expiré en pointillé bordeaux, accompli barré en vert.
- **Mobile (< 56 rem)** : la frise devient verticale, avec l'axe à gauche.
- **Ajouter un acte** (boîte de dialogue) : nature de l'acte, date, résidence de la partie, art. 647. Les délais qui découlent de l'acte sont proposés en cases à cocher (par exemple, une signification de jugement propose appel, opposition et pourvoi).
- **Modifier un acte** : nouvelle date, puis recalcul. Un message indique ce qui change, par exemple « Pourvoi 30/12/2026 → 01/02/2027 ».

## Panneau des paramètres

```
Paramètres
┌ Seuils d'alerte ───────────────────────────────────────────────────────┐
│ Seuil rouge : expire dans N jours ou moins  [ 3 ]  Par défaut : 3      │
│ Seuil orange : expire dans N jours ou moins [ 7 ]  Strictement > rouge │
│ ✖ Le seuil orange (4 j) doit être strictement supérieur au seuil rouge │  ← si erreur
│ Aperçu : ⛔ Expiré hier  ⚠️ Aujourd'hui  ⚠️ 3 j  ⏳ 4 j  ⏳ 7 j  📅 8 j   │
│ [Enregistrer les seuils] [Rétablir les valeurs par défaut]             │
└────────────────────────────────────────────────────────────────────────┘
┌ Jours chômés supplémentaires ┐  date + motif, recalcul de tous les délais
┌ Données et sauvegarde ┐  [⬇ Exporter] [⬆ Importer…] [Recharger la démo] [Tout effacer]
┌ Chiffrement local ┐      [Activer le chiffrement] (phrase secrète, 12 caractères min.)
┌ Analyse par IA externe (facultatif) ┐  désactivée par défaut ; URL du proxy + jeton
┌ À propos des règles ┐    versions des fichiers JSON, lien vers les tests
```

- L'aperçu se met à jour pendant la saisie. Les champs fautifs passent en `aria-invalid` et le message d'erreur est annoncé aux lecteurs d'écran.
- Les seuils peuvent aussi être **propres à une affaire** (Modifier l'affaire > Seuils), avec le même contrôle de cohérence.

## Autres écrans

- **Calculateur** : formulaire à gauche ; à droite, l'échéance en grand, la pastille, le calcul pas à pas et un bouton « Ajouter à une affaire ».
- **Compétence** : une question par écran, avec le fil des réponses déjà données (modifiable). Le résultat donne les fondements matériels et territoriaux, la représentation et le préalable amiable. Un champ commune par rattachement possible renvoie la juridiction précise, puis le bouton « Retenir pour cette affaire » l'enregistre.
- **Document** : zone de dépôt, puis formulaire de validation. Chaque champ affiche l'extrait du document qui le justifie et un niveau de confiance. La case « J'ai vérifié… » est obligatoire avant tout enregistrement.
