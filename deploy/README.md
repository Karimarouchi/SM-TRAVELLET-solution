# Mise en production — VPS vierge

> **Kit actuel : `deploy/new-vps/`** (nginx + Docker, domaine `www.smtravel.fr`). Voir `deploy/new-vps/MIGRATION.md`.
> Les fichiers ci-dessous (Caddy, `install-vps.sh`) décrivent une ancienne approche, non utilisée.

Cette stack installe **tout** : Docker, PostgreSQL 16, l’API Node, la vitrine, l’application (`/app/`), et le HTTPS (Let’s Encrypt via Caddy).

## Avant de commencer

1. Un VPS Ubuntu 22.04 / 24.04 ou Debian 12, **root** ou sudo.
2. Un nom de domaine dont l’enregistrement **A** pointe vers l’IP du VPS (ex. `smtravel.fr`).
   - Sans domaine : mettez `SITE_ADDRESS=:80` et `APP_PUBLIC_URL=http://VOTRE_IP` (pas de HTTPS automatique).
3. Ports **22, 80, 443** ouverts chez l’hébergeur.
4. Le code du projet sur le serveur (git clone ou envoi des fichiers).

## Installation (une commande)

Sur le VPS, à la racine du projet :

```bash
sudo bash deploy/install-vps.sh
```

Le script ouvre `.env` : renseignez **votre domaine**, le **compte admin**, et de préférence **SMTP** (Gmail : mot de passe d’application). Les secrets JWT et PostgreSQL sont générés automatiquement au premier lancement.

## URLs

| Page | Adresse |
|---|---|
| Site vitrine | `https://VOTRE_DOMAINE/` |
| Connexion app | `https://VOTRE_DOMAINE/app/#/login` |
| API (santé) | `https://VOTRE_DOMAINE/api/health` |
| Webhook WhatsApp | `https://VOTRE_DOMAINE/api/whatsapp/webhook` |

Premier admin = `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`. Aucun compte démo n’est créé en production.

## Mise à jour du code

```bash
cd /chemin/vers/SM-TRAVELLE
git pull   # ou recopiez les fichiers
docker compose --profile production up -d --build
```

Les documents uploadés et PostgreSQL restent dans des volumes Docker.

## SMTP (emails d’inscription)

Sans `SMTP_USER` / `SMTP_PASS`, le site fonctionne mais les codes de vérification email ne partent pas. Pour Gmail : compte → sécurité → mot de passe d’application.

## WhatsApp / Google Calendar

Optionnel. Voir `backend/WHATSAPP.md` et `backend/GOOGLE_CALENDAR.md`. Le callback Google doit être `https://VOTRE_DOMAINE/api/google/callback`.

## Commandes utiles

```bash
docker compose --profile production ps
docker compose --profile production logs -f backend
docker compose --profile production restart backend
```
