# Nouveau VPS — tout dans Docker (www.smtravel.fr)

Même logique que d'habitude : **tout tourne dans des conteneurs Docker**, y compris nginx (fichier de configuration dans `deploy/nginx/`) et le renouvellement du certificat HTTPS. Sur le serveur, il n'y a rien d'autre à installer que Docker.

```
Internet ──► conteneur nginx (80/443)
              ├─ /          → vitrine statique (dans l'image nginx)
              ├─ /app/      → conteneur frontend
              ├─ /api/      → conteneur backend
              └─ /uploads/  → conteneur backend
             conteneur postgres (jamais exposé sur Internet)
```

## Installation neuve (serveur vide)

```bash
cd /var/www/SM-TRAVELLET-solution
git pull origin main

# 1) Docker + pare-feu (une seule fois)
sudo bash deploy/new-vps/01-install.sh

# 2) Fichiers de configuration (une seule fois ; contiennent des secrets, hors de git)
sudo ADMIN_EMAIL=votre@email.com bash deploy/new-vps/init-env.sh
#    -> affiche UNE FOIS le mot de passe du premier administrateur

# 3) Démarrer (compile les images : 10 à 15 minutes la première fois)
docker compose --profile production up -d --build
docker compose --profile production ps
curl -s http://127.0.0.1:3002/api/health
```

Le site répond alors en HTTP sur l'adresse IP du serveur (`http://191.215.44.82/`).

## DNS (Hostinger)

Modifier uniquement les deux enregistrements **A** : `@` et `www` → `191.215.44.82` (TTL 300). Ne pas toucher aux `MX`, `TXT` et `CNAME` (ce sont les e-mails `@smtravel.fr`). Supprimer un éventuel `AAAA`.

```bash
dig +short www.smtravel.fr @1.1.1.1     # doit afficher 191.215.44.82
```

## HTTPS

Dès que le DNS pointe vers le serveur :

```bash
bash deploy/new-vps/ssl.sh votre@email.com
```

Le script vérifie le DNS, demande le certificat Let's Encrypt (www et sans www), puis redémarre le conteneur nginx, qui passe tout seul en HTTPS. `smtravel.fr` et le HTTP redirigent vers `https://www.smtravel.fr`. Le renouvellement est automatique (conteneur `certbot-renew`).

## Programmes de la vitrine (facultatif)

La section « Programmes » du site est vide sur une base neuve :

```bash
sudo bash deploy/new-vps/seed-programmes.sh
```

(sans effet si des programmes existent déjà)

## Mises à jour (vos commandes habituelles)

```bash
cd /var/www/SM-TRAVELLET-solution
git pull origin main
docker compose build --no-cache backend frontend nginx
docker compose up -d --force-recreate backend frontend nginx
docker compose logs --tail=60 backend
```

> `nginx` contient la vitrine (`index.html`, images…) : ajoutez-le à la reconstruction dès que le site vitrine change. Pour une modification du backend ou de l'application seulement, `backend frontend` suffit.

## Après la première connexion

- `https://www.smtravel.fr/app/#/login` avec l'e-mail admin choisi et le mot de passe affiché.
- Paramètres → envoi d'e-mails : `services@smtravel.fr` et le serveur Hostinger (rien à saisir sur le serveur).
- WhatsApp et Google (facultatif) : ajouter les clés dans `backend/.env`, puis `docker compose up -d --force-recreate backend`. Adresses à déclarer :
  - WhatsApp (Meta) : `https://www.smtravel.fr/api/whatsapp/webhook`
  - Google (redirection autorisée) : `https://www.smtravel.fr/api/google/callback`

## Commandes utiles

```bash
docker compose --profile production ps
docker compose logs -f backend
docker compose logs --tail=40 nginx
docker compose restart nginx            # après un changement de certificat
```

## Ancien serveur

Sur l'ancien serveur (nginx hors Docker sur les ports 80/443), n'utilisez pas `docker compose --profile production up` sans nom de service : le conteneur nginx essaierait de prendre ces ports. Continuez avec `docker compose build ... backend frontend` et `docker compose up -d ... backend frontend`.
