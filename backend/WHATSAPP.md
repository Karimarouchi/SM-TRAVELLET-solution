# WhatsApp Business dans SM Travel

Les étudiants écrivent au numéro WhatsApp de l'agence (**+216 57 031 130**).
Leurs messages arrivent dans l'application (menu **WhatsApp**), où les sales
y répondent directement. Chaque sales est aussi prévenu par une notification
(cloche) quand une nouvelle conversation lui est attribuée.

## Qui voit quoi

- **Sales** : uniquement les conversations qui lui sont attribuées.
- **Admin** : toutes les conversations, avec le filtre « Non attribuées », et
  peut réattribuer une conversation à un autre sales.

## Répartition automatique

Quand un numéro écrit :

1. S'il correspond au téléphone d'un étudiant (profil étudiant), la
   conversation est liée à cet étudiant et va **à son conseiller**.
2. Sinon, elle va au **sales actif qui a le moins de conversations WhatsApp**.
3. S'il n'y a aucun sales actif, elle reste **non attribuée** (visible par
   l'admin) et sera donnée au premier sales créé ou réactivé.

Ensuite :

- Une conversation liée à un étudiant **suit toujours son conseiller** : si
  l'étudiant change de conseiller, la conversation le suit.
- « Transférer + Bloquer » un sales transfère aussi ses conversations
  WhatsApp au sales choisi.
- Passer un sales « Inactif » redistribue ses conversations aux sales actifs
  les moins chargés.
- Lier manuellement une conversation à un étudiant (bouton « Lier à un
  étudiant ») la déplace chez le conseiller de cet étudiant.

## Documents

Les photos/fichiers envoyés par WhatsApp **ne sont pas récupérés** : la
conversation affiche « Fichier reçu — les documents doivent être déposés sur
la plateforme ». L'étudiant doit se connecter et déposer ses documents dans
son espace.

## Règle des 24 h (imposée par WhatsApp)

On ne peut répondre librement que dans les **24 h qui suivent le dernier
message de l'étudiant**. Passé ce délai, la zone de saisie est désactivée
avec un bandeau d'explication : l'étudiant doit réécrire (ou il faudrait un
modèle de message approuvé par Meta, non géré ici).

## 1. Variables d'environnement (`backend/.env`)

```
WHATSAPP_TOKEN=            # token permanent du System User (Meta Business)
WHATSAPP_APP_SECRET=       # clé secrète de l'app Meta (Paramètres → Général)
WHATSAPP_VERIFY_TOKEN=     # texte libre que VOUS choisissez, recopié chez Meta
WHATSAPP_PHONE_NUMBER_ID=1185838064603179
WHATSAPP_GRAPH_VERSION=v23.0
```

Sans ces variables, l'application démarre normalement ; seules les routes
WhatsApp répondent 503 (« WhatsApp non configuré »).

- En **local** : dans `backend/.env` à la racine du dossier `backend`.
- En **production (VPS)** : dans `backend/.env` du dossier du projet sur le
  serveur (c'est ce fichier que lit `docker-compose.yml`), puis redémarrer le
  backend : `docker compose --profile production up -d --build`.

## 2. Configuration chez Meta

Dans Meta for Developers → votre app → **WhatsApp → Configuration** :

- **URL de rappel** : `https://www.smtravel.fr/api/whatsapp/webhook`
- **Token de vérification** : exactement la valeur de `WHATSAPP_VERIFY_TOKEN`
- Cliquer **Vérifier et enregistrer**, puis dans **Champs du webhook**,
  **s'abonner au champ `messages`**.

## 3. Tester

Vérification du webhook (doit afficher `12345`) :

```
https://www.smtravel.fr/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=VOTRE_VERIFY_TOKEN&hub.challenge=12345
```

Simulation d'un message entrant signé, sans passer par Meta (backend lancé,
`WHATSAPP_APP_SECRET` défini) :

```
node backend/scripts/simulate-whatsapp-webhook.js 21655480282 "Bonjour"
```

Le script vérifie qu'une signature invalide est refusée (401), que le message
est enregistré en base, et qu'un renvoi du même message ne crée pas de
doublon.

**Tester avec de vrais messages en local** : Meta doit pouvoir joindre votre
machine, ce qui n'est pas possible sur `localhost`. Il faut soit un tunnel
(`cloudflared tunnel --url http://localhost:3001` ou `ngrok http 3001`, puis
mettre l'URL du tunnel + `/api/whatsapp/webhook` chez Meta), soit tester
directement sur le serveur. L'**envoi** de réponses, lui, fonctionne en local
dès que `WHATSAPP_TOKEN` est renseigné.

## Si Meta n'arrive pas à joindre le webhook

Le nginx du VPS doit transmettre `/api/` au backend (déjà le cas avec la
configuration actuelle : `location /api/ { proxy_pass http://localhost:3002; }`).
Vérifications :

```
curl -i "http://localhost:3002/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=VOTRE_VERIFY_TOKEN&hub.challenge=1"
curl -i "https://www.smtravel.fr/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=VOTRE_VERIFY_TOKEN&hub.challenge=1"
```

- La 1re répond `1` mais pas la 2e → problème nginx : vérifier le bloc
  `location /api/` dans `/etc/nginx/sites-available/smtravel`,
  puis `nginx -t && systemctl reload nginx`.
- Les deux répondent `503` → les variables WhatsApp ne sont pas chargées :
  vérifier `backend/.env` et relancer le backend.
- Réponse `403` → le verify token ne correspond pas.

Journaux utiles : `backend/logs/combined.log` et `backend/logs/error.log`
(dans le conteneur : `docker logs sm-travel-backend`).
