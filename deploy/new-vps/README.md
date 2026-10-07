# Nouveau serveur — www.smtravel.fr

Même méthode que d'habitude : **Docker** pour tout le site (API, vitrine + application React, PostgreSQL) et **un fichier nginx** dans `/etc/nginx` qui route les conteneurs.

## 1. Installer ce qui manque sur le serveur vide (une seule fois)

```bash
cd /var/www/SM-TRAVELLET-solution
git pull origin main
sudo bash deploy/new-vps/01-install.sh      # Docker, nginx, certbot, pare-feu (ports 22/80/443)
```

(équivalent manuel : `apt install docker.io docker-compose-v2 nginx certbot python3-certbot-nginx`)

## 2. Les deux fichiers `.env` (ils ne sont pas dans git : ce sont des secrets)

Ils existent déjà sur l'ancien serveur ; vous pouvez les recopier comme d'habitude. Sinon, ce script les crée à votre place (il ne remplace jamais un fichier existant) :

```bash
sudo ADMIN_EMAIL=votre@email.com bash deploy/new-vps/init-env.sh
```

Pourquoi ces deux fichiers sont indispensables :

| Fichier | Contenu | Sans lui |
|---|---|---|
| `.env` (racine) | mot de passe PostgreSQL, `VITE_API_URL` | `docker compose` refuse de démarrer |
| `backend/.env` | clé de sécurité (JWT), premier administrateur | l'API ne démarre pas, et en production **aucun compte n'existe** : sans le premier administrateur, personne ne peut se connecter |

Le mot de passe de l'administrateur est affiché une seule fois par le script : notez-le, puis changez-le après la première connexion.

Si vous les créez à la main :

```
# .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<mot de passe long>
POSTGRES_DB=sm_travel
VITE_API_URL=https://www.smtravel.fr

# backend/.env
PORT=3001
NODE_ENV=production
JWT_SECRET=<64 caractères aléatoires>
APP_PUBLIC_URL=https://www.smtravel.fr
CORS_ORIGIN=https://www.smtravel.fr
ADMIN_BOOTSTRAP_EMAIL=votre@email.com
ADMIN_BOOTSTRAP_PASSWORD=<mot de passe>
```

## 3. Démarrer l'application (Docker)

```bash
docker compose --profile production up -d --build
docker compose --profile production ps
curl -s http://127.0.0.1:3002/api/health
```

## 4. Le fichier nginx

Tout le site est dans Docker : le conteneur **frontend** sert la vitrine (`/`) et l'application (`/app/`), le conteneur **backend** sert `/api/` et `/uploads/`. Le fichier nginx de l'hôte ne fait que router ces deux conteneurs (aucun dossier de site à gérer).

```bash
cp /var/www/SM-TRAVELLET-solution/deploy/new-vps/nginx-smtravel.conf /etc/nginx/sites-available/smtravel
ln -sf /etc/nginx/sites-available/smtravel /etc/nginx/sites-enabled/smtravel
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Test (avant de changer le DNS) :

```bash
curl -sI -H "Host: www.smtravel.fr" http://127.0.0.1/ | head -1          # 200 : vitrine
curl -sI -H "Host: www.smtravel.fr" http://127.0.0.1/app/ | head -1      # 200 : application
curl -s  -H "Host: www.smtravel.fr" http://127.0.0.1/api/health           # {"ok":true,...}
```

## 5. DNS (Hostinger)

Modifier uniquement les deux enregistrements **A** : `@` et `www` → `191.215.44.82` (TTL 300). Ne pas toucher aux `MX`, `TXT`, `CNAME` (e-mails `@smtravel.fr`). Supprimer un éventuel `AAAA`.

```bash
dig +short www.smtravel.fr @1.1.1.1     # doit afficher 191.215.44.82
```

## 6. HTTPS

Dès que le DNS pointe vers le serveur :

```bash
certbot --nginx -d www.smtravel.fr -d smtravel.fr --redirect -m votre@email.com --agree-tos
```

certbot ajoute le HTTPS au fichier nginx et le renouvellement automatique.

## 7. Programmes de la vitrine (facultatif)

La section « Programmes » du site est vide sur une base neuve :

```bash
sudo bash deploy/new-vps/seed-programmes.sh
```

## Mises à jour (vos commandes habituelles)

```bash
cd /var/www/SM-TRAVELLET-solution
git pull origin main
docker compose build --no-cache backend frontend
docker compose up -d --force-recreate backend frontend
docker compose logs --tail=60 backend
```

L'image `frontend` contient la vitrine : un changement du site vitrine (`index.html`, images…) se met en ligne avec la même commande. Si le fichier `deploy/new-vps/nginx-smtravel.conf` change, recopiez-le (étape 4).

## Après la première connexion

- `https://www.smtravel.fr/app/#/login`
- Paramètres → envoi d'e-mails : `services@smtravel.fr` et le serveur Hostinger.
- WhatsApp / Google (facultatif) : ajouter les clés dans `backend/.env`, puis `docker compose up -d --force-recreate backend`. Adresses à déclarer :
  - WhatsApp (Meta) : `https://www.smtravel.fr/api/whatsapp/webhook`
  - Google (redirection autorisée) : `https://www.smtravel.fr/api/google/callback`
