#!/usr/bin/env python3
"""Convertit le jeu de données officiel « Liste des juridictions compétentes
pour les communes de France » (data.gouv.fr, ministère de la Justice) au format
de data/juridictions/echantillon.json, pour remplacer l'échantillon de démonstration.

Le format exact du CSV peut évoluer. Le script accepte donc deux formes :

1. Format « large » : une ligne par commune, une colonne par type de juridiction.
   python3 tools/build-juridictions.py fichier.csv --insee code_insee \
       --tj "tribunal_judiciaire" --cph "conseil_prudhommes" --ca "cour_appel" \
       --tc "tribunal_commerce" > data/juridictions/complet.json

2. Format « long » : une ligne par couple commune / juridiction.
   python3 tools/build-juridictions.py fichier.csv --insee code_insee \
       --type-col type_juridiction --nom-col nom_juridiction \
       --map "TJ=tj,CPH=cph,CA=ca,TC=tc,TAE=tc" > data/juridictions/complet.json

Lancez d'abord avec --entetes pour afficher les colonnes du fichier.
Ensuite, dans js/app.js, remplacez « echantillon.json » par « complet.json ».
"""
import argparse
import csv
import json
import sys


def ouvrir(chemin):
    with open(chemin, encoding="utf-8-sig", newline="") as f:
        echantillon = f.read(4096)
        f.seek(0)
        dialecte = csv.Sniffer().sniff(echantillon, delimiters=";,\t")
        yield from csv.DictReader(f, dialect=dialecte)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("csv")
    p.add_argument("--entetes", action="store_true", help="affiche les colonnes et quitte")
    p.add_argument("--insee", help="colonne du code INSEE de la commune")
    for t in ("tj", "cph", "ca", "tc"):
        p.add_argument(f"--{t}", help=f"colonne du nom de la juridiction {t} (format large)")
    p.add_argument("--type-col")
    p.add_argument("--nom-col")
    p.add_argument("--map", default="", help="correspondance type=clé (format long)")
    a = p.parse_args()

    lignes = ouvrir(a.csv)
    if a.entetes:
        print(list(next(lignes).keys()))
        return
    if not a.insee:
        sys.exit("--insee est obligatoire (utilisez --entetes pour voir les colonnes)")

    communes = {}
    correspondance = dict(x.split("=", 1) for x in a.map.split(",") if "=" in x)
    for l in lignes:
        code = (l.get(a.insee) or "").strip().zfill(5)
        if not code.strip("0"):
            continue
        c = communes.setdefault(code, {})
        if a.type_col:
            cle = correspondance.get((l.get(a.type_col) or "").strip())
            if cle:
                c[cle] = (l.get(a.nom_col) or "").strip()
        else:
            for t in ("tj", "cph", "ca", "tc"):
                col = getattr(a, t)
                if col and l.get(col):
                    c[t] = l[col].strip()
    for c in communes.values():
        c["tae"] = "activités économiques" in c.get("tc", "").lower()

    json.dump({
        "meta": {
            "source": "Liste des juridictions compétentes pour les communes de France — ministère de la Justice (data.gouv.fr)",
            "avertissement": "Vérifiez la date de mise à jour du fichier source ; des incohérences ont été signalées sur certaines versions.",
            "complet": True,
        },
        "communes": communes,
    }, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
