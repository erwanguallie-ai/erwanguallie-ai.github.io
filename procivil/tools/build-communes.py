#!/usr/bin/env python3
"""Génère data/communes.json (format compact) à partir du référentiel
@etalab/decoupage-administratif (fichier communes.json, licence ouverte Etalab).

Usage :
    python3 tools/build-communes.py chemin/vers/communes.json > data/communes.json

Format produit :
    {"meta": {...}, "c": [[insee, nom, departement, code_postal_principal], ...]}

Le département permet de déduire la zone de jours fériés (Alsace-Moselle,
DROM) et la zone de délai de distance (art. 643 et 644 CPC).
"""
import json
import sys


def main(src):
    with open(src, encoding="utf-8") as f:
        communes = json.load(f)
    rows = []
    for c in communes:
        if c.get("type") not in ("commune-actuelle", "arrondissement-municipal"):
            continue
        dep = c.get("departement") or c.get("collectiviteOutremer", {}).get("code") or c["code"][:3]
        cps = c.get("codesPostaux") or [""]
        rows.append([c["code"], c["nom"], dep, cps[0]])
    rows.sort(key=lambda r: r[1])
    out = {
        "meta": {
            "source": "@etalab/decoupage-administratif (COG INSEE), licence ouverte Etalab 2.0",
            "nombre": len(rows),
            "format": ["insee", "nom", "departement", "code_postal"],
        },
        "c": rows,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main(sys.argv[1])
