# 5. Mise en ligne sur les pages perso Free

> Les modalités de l'offre « Pages Perso » de Free (activation, hôte FTP, HTTPS, quota) ont évolué au fil des années. Les étapes ci-dessous correspondent au fonctionnement connu (FTP vers `ftpperso.free.fr`, site sur `http://<identifiant>.free.fr`). Vérifiez-les dans l'assistance Free avant de commencer. L'application elle-même n'exige qu'un hébergement de fichiers statiques : elle fonctionne à l'identique sur n'importe quel autre hébergeur.

## Étape 0 : tester en local

1. Décompressez l'archive `procivil.zip`.
2. Dans le dossier `procivil/`, lancez un petit serveur web :
   - avec Python : `python3 -m http.server 8000` ;
   - avec PHP : `php -S localhost:8000`.
3. Ouvrez `http://localhost:8000` : quatre affaires de démonstration s'affichent.
4. Ouvrez `http://localhost:8000/tests.html` : le compteur doit afficher **79 / 79**.

Ouvrir `index.html` par un double-clic ne fonctionne pas : les navigateurs bloquent les modules JavaScript et les fichiers JSON en `file://`. L'outil affiche alors un message explicatif.

## Étape 1 : activer les pages perso

1. Connectez-vous à votre espace abonné Free. Pour un compte non abonné, passez par la création d'un compte Free gratuit, si Free la propose encore.
2. Activez le service « Pages Perso » et notez :
   - l'**identifiant** (par exemple `moncabinet`) ;
   - le **mot de passe** FTP.
3. L'activation peut prendre quelques heures. L'adresse du site sera `http://moncabinet.free.fr/`.

## Étape 2 : préparer les fichiers

Le dossier à envoyer est le dossier `procivil/` complet, soit environ 16 Mo dont 13 Mo pour le moteur OCR. Vous pouvez ne pas envoyer :

| Dossier | Rôle |
|---|---|
| `tools/` | Scripts de génération des données, utiles hors ligne seulement |
| `proxy/` | Code du proxy IA, qui se déploie ailleurs (voir `docs/IA-EXTERNE.md`) |
| `tests/run-node.mjs` | Lanceur Node ; **gardez en revanche `tests/cas.js`**, qu'utilise `tests.html` |

Pour publier ailleurs que dans la racine, par exemple dans `http://moncabinet.free.fr/procivil/`, envoyez simplement le dossier tel quel. Tous les chemins sont relatifs.

## Étape 3 : envoyer par FTP (FileZilla)

1. Installez FileZilla Client.
2. Ouvrez Fichier > Gestionnaire de sites > Nouveau site, puis renseignez :

   | Champ | Valeur |
   |---|---|
   | Protocole | FTP |
   | Hôte | `ftpperso.free.fr` |
   | Port | 21 |
   | Chiffrement | « Utiliser FTP explicite sur TLS si disponible » |
   | Type d'authentification | Normale |
   | Identifiant | `moncabinet` |
   | Mot de passe | le mot de passe des pages perso |

3. Dans l'onglet Paramètres de transfert, choisissez « Mode de transfert : Passif ».
4. Connectez-vous. Dans le panneau de droite (le serveur), placez-vous à la racine ou dans un sous-dossier `procivil`.
5. Dans le panneau de gauche, sélectionnez **le contenu** du dossier `procivil/` et glissez-le à droite. Les fichiers `.traineddata` et `.js` doivent partir en mode **binaire** (Transfert > Type de transfert > Binaire, ou Automatique).
6. Une fois l'envoi terminé, comparez les tailles. `vendor/tesseract/lang/fra.traineddata` doit faire 1 248 107 octets.

## Étape 4 : vérifier en ligne

1. Ouvrez `http://moncabinet.free.fr/` (ou `…/procivil/`).
2. Ouvrez `…/tests.html` : vous devez obtenir **79 / 79**. Un échec à cette étape vient presque toujours d'un fichier JSON mal transféré ou servi avec un mauvais type MIME.
3. Testez le dépôt d'un PDF : le premier OCR télécharge environ 5 Mo (moteur et modèle français), qui sont ensuite mis en cache.
4. Si la page reste sur « Chargement… », ouvrez la console du navigateur (F12) :
   - **« MIME type »** : le serveur sert un `.js` ou un `.json` avec un mauvais type. Ajoutez un fichier `.htaccess` (étape 5) ou demandez l'assistance Free.
   - **« 404 »** : un fichier ou un dossier manque, ou un nom ne respecte pas la casse (`Data/` au lieu de `data/`).

## Étape 5 (facultative) : `.htaccess`

Les serveurs de Free acceptent historiquement un `.htaccess` restreint. Testez-le **sur un sous-dossier d'essai** d'abord : une directive refusée provoque une erreur 500 sur tout le dossier.

```apache
# Types MIME (si les modules ou le JSON sont mal servis)
AddType text/javascript .js
AddType application/json .json
AddType application/octet-stream .traineddata
# Pas d'indexation par les moteurs de recherche
Header set X-Robots-Tag "noindex, nofollow"
```

Pour réserver l'accès au cabinet, une protection par mot de passe (`AuthType Basic`) est parfois possible sur les pages perso. Vérifiez dans l'assistance Free. Notez qu'en HTTP, ce mot de passe circule en clair. Aucune donnée d'affaire n'est stockée sur le serveur, mais une protection évite que l'outil soit utilisé par des tiers.

## Étape 6 : HTTPS

- Si votre site répond en `https://moncabinet.free.fr`, **utilisez cette adresse**. Le chiffrement local (WebCrypto) n'est disponible qu'en HTTPS, et le proxy IA éventuel n'acceptera que cette origine.
- En HTTP seul, l'outil fonctionne, mais l'option « chiffrement local » affichera une erreur. Le transport de l'application n'est pas protégé, alors que les données, elles, restent locales.
- Les données enregistrées sous `http://` et sous `https://` sont **distinctes** : exportez-les puis réimportez-les si vous changez d'adresse.

## Étape 7 : mettre à jour les règles

1. Modifiez `data/delais.json` (ou un autre fichier de règles) : durée, article, `verifie`, note.
2. Lancez `node tests/run-node.mjs` en local et ajoutez un cas dans `tests/cas.js` si la règle est nouvelle.
3. Renvoyez le seul fichier modifié par FTP, puis rouvrez `tests.html` en ligne.
4. Les délais déjà enregistrés sont recalculés lors de leur prochaine modification. Pour tout recalculer, ajoutez puis retirez un jour chômé dans les paramètres.

Pour la correspondance commune → juridiction complète : téléchargez le jeu « Liste des juridictions compétentes pour les communes de France » sur data.gouv.fr, puis lancez :

```
python3 tools/build-juridictions.py fichier.csv --entetes
python3 tools/build-juridictions.py fichier.csv --insee <col> --tj <col> --cph <col> --ca <col> --tc <col> > data/juridictions/complet.json
```

Enfin, remplacez `echantillon.json` par `complet.json` dans `js/app.js` (fonction `chargerCommunes`).
