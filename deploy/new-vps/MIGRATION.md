# Migration vers le nouveau VPS — www.smtravel.fr

Ce guide déplace **tout** (vitrine, application, API, base de données, documents des étudiants) vers un VPS vierge, sous le domaine **www.smtravel.fr**.

| | Adresse IP | Rôle |
|---|---|---|
| Ancien serveur | `187.127.94.149` | reste intact jusqu'à la fin (sert de plan B) |
| Nouveau serveur | `191.215.44.82` | `/var/www/SM-TRAVELLET-solution` (projet déjà cloné) |

Architecture finale sur le nouveau serveur :

```
Internet ──► nginx (80/443, certificat Let's Encrypt)
              ├─ /          → vitrine statique   /var/www/smtravel-vitrine
              ├─ /app/      → conteneur frontend (127.0.0.1:8081)
              ├─ /api/      → conteneur backend  (127.0.0.1:3002)
              └─ /uploads/  → conteneur backend
             PostgreSQL 16 : conteneur, jamais exposé sur Internet
```

## Ordre des opérations

| # | Étape | Où |
|---|---|---|
| A | Sauvegarder base, documents et secrets | ancien serveur |
| B | Installer Docker, nginx, certbot | nouveau serveur |
| C | Copier `backend/.env` | nouveau serveur |
| D | Restaurer les données et démarrer l'application | nouveau serveur |
| E | **Changer le DNS** | Hostinger |
| F | Activer le HTTPS | nouveau serveur |
| G | Mettre à jour Google, WhatsApp et vérifier | consoles externes |

> Les étapes A à D n'ont **aucun effet** sur le site actuel : il continue de fonctionner tant que le DNS (étape E) n'est pas changé.

---

## A. Sauvegarder l'ancien serveur

```bash
ssh root@187.127.94.149
cd /var/www/smapplication

# Base de données (format compressé)
docker exec sm-travel-postgres pg_dump -U postgres -d sm_travel -Fc -f /tmp/sm_travel.dump
docker cp sm-travel-postgres:/tmp/sm_travel.dump /root/sm_travel.dump

# Documents, avatars et images envoyés par les utilisateurs
docker cp sm-travel-backend:/app/uploads /root/uploads-backup
tar czf /root/uploads-backup.tgz -C /root uploads-backup
ls -lh /root/sm_travel.dump /root/uploads-backup.tgz
```

Refaites **cette étape A juste avant la bascule du DNS** (étape E) : tout ce qui est saisi sur l'ancien site après la sauvegarde ne sera pas dans le nouveau. Prévenez l'équipe de ne rien saisir pendant la bascule (≈ 30 minutes).

## B. Installer le nouveau serveur

```bash
ssh root@191.215.44.82
cd /var/www/SM-TRAVELLET-solution
git pull origin main
sudo bash deploy/new-vps/01-install.sh
```

Le script installe Docker (et `docker compose`), nginx, certbot, active le pare-feu (ports 22, 80, 443 seulement) et ajoute 2 Go de swap si la mémoire est faible (utile pour compiler l'application).

Si le script indique « système à redémarrer » : `sudo reboot`, puis reconnectez-vous.

## C. Copier les secrets (`backend/.env`)

Depuis le **nouveau** serveur :

```bash
scp root@187.127.94.149:/var/www/smapplication/backend/.env /var/www/SM-TRAVELLET-solution/backend/.env
chmod 600 /var/www/SM-TRAVELLET-solution/backend/.env
```

Ce fichier contient vos clés (SMTP, WhatsApp, Google…). Le script de l'étape D remplace automatiquement les adresses par le nouveau domaine :

| Variable | Valeur imposée |
|---|---|
| `APP_PUBLIC_URL` | `https://www.smtravel.fr` |
| `CORS_ORIGIN` | `https://www.smtravel.fr` |
| `GOOGLE_REDIRECT_URI` | `https://www.smtravel.fr/api/google/callback` |
| `NODE_ENV` | `production` |

Le fichier `.env` **à la racine** du projet (mot de passe PostgreSQL + adresse de l'API) est créé automatiquement, avec un nouveau mot de passe généré.

## D. Restaurer les données et démarrer

```bash
cd /var/www/SM-TRAVELLET-solution

# 1) PostgreSQL seul
sudo bash deploy/new-vps/02-start-app.sh db

# 2) Récupérer les sauvegardes de l'ancien serveur
scp root@187.127.94.149:/root/sm_travel.dump /root/
scp root@187.127.94.149:/root/uploads-backup.tgz /root/

# 3) Restaurer la base
docker cp /root/sm_travel.dump sm-travel-postgres:/tmp/sm_travel.dump
docker exec sm-travel-postgres pg_restore -U postgres -d sm_travel --no-owner --clean --if-exists /tmp/sm_travel.dump
#   (quelques avertissements « does not exist, skipping » sont normaux)

# 4) Démarrer toute l'application (compile l'API et l'application : plusieurs minutes)
sudo bash deploy/new-vps/02-start-app.sh

# 5) Restaurer les documents
tar xzf /root/uploads-backup.tgz -C /root
docker cp /root/uploads-backup/. sm-travel-backend:/app/uploads/
docker exec -u root sm-travel-backend chown -R node:node /app/uploads
```

Vérifications locales sur le serveur :

```bash
curl -s http://127.0.0.1:3002/api/health        # doit répondre {"status":"ok"...}
curl -sI http://127.0.0.1:8081/app/ | head -1   # HTTP/1.1 200 OK
curl -sI http://localhost/ | head -1            # HTTP/1.1 200 OK (vitrine)
docker compose --profile production logs --tail=40 backend
```

## E. Changer le DNS (Hostinger)

Hostinger → **Domaines** → `smtravel.fr` → **DNS / Serveurs de noms** → **Enregistrements DNS**.

| Type | Nom | Ancienne valeur | **Nouvelle valeur** | TTL |
|---|---|---|---|---|
| A | `@` | 187.127.94.149 | **191.215.44.82** | 300 |
| A | `www` | 187.127.94.149 | **191.215.44.82** | 300 |

**À ne PAS toucher** (ce sont les e-mails `@smtravel.fr`) : les deux `MX` (mx1/mx2.hostinger.com), les `TXT` (SPF, DKIM `hostingermail…_domainkey`, DMARC) et les `CNAME` `autodiscover` / `autoconfig`.

S'il existe un enregistrement **AAAA** (IPv6) pour `@` ou `www`, supprimez-le (sinon une partie des visiteurs continue d'aller sur l'ancien serveur).

Contrôle (le résultat peut mettre quelques minutes à changer) :

```bash
dig +short www.smtravel.fr @1.1.1.1    # doit afficher 191.215.44.82
dig +short smtravel.fr @1.1.1.1        # idem
```

## F. Activer le HTTPS

Dès que les deux commandes `dig` affichent la nouvelle adresse :

```bash
cd /var/www/SM-TRAVELLET-solution
sudo bash deploy/new-vps/03-ssl.sh votre@email.com
```

Le script vérifie le DNS, obtient le certificat Let's Encrypt (www et sans www), active le HTTPS, redirige `smtravel.fr` et le HTTP vers `https://www.smtravel.fr`, et teste le renouvellement automatique.

> Entre le changement de DNS et la fin de cette étape (quelques minutes), les visiteurs qui arrivent déjà sur le nouveau serveur peuvent voir un avertissement de certificat. Enchaînez E puis F sans attendre.

## G. Services externes et vérifications

1. **Google (agenda / Meet)** — Google Cloud Console → Identifiants → votre client OAuth → *URI de redirection autorisés* : ajouter exactement `https://www.smtravel.fr/api/google/callback`. Dans *Écran de consentement* : domaine autorisé `smtravel.fr`. Puis, dans l'application : Paramètres → reconnecter Google.
2. **WhatsApp (Meta)** — Meta for Developers → WhatsApp → Configuration → Webhook : URL de rappel `https://www.smtravel.fr/api/whatsapp/webhook` (même *verify token* que dans `backend/.env`), puis « Vérifier et enregistrer ».
3. **E-mails** — rien à changer : les réglages SMTP sont dans la base restaurée et l'expéditeur `services@smtravel.fr` reste chez Hostinger. Envoyez-vous un code de vérification pour tester.
4. **Vérifications** :
   - `https://www.smtravel.fr/` : vitrine
   - `https://www.smtravel.fr/app/#/login` : connexion admin avec vos identifiants habituels
   - Ouvrir un document étudiant (test des fichiers restaurés)
   - Générer un code, tester la messagerie WhatsApp, créer un événement Meet
5. **Ancien domaine** (facultatif, une fois tout validé) : sur l'ancien serveur, faire rediriger `sm.antigoneinterne.agency` vers `https://www.smtravel.fr` (301).

## Mises à jour futures

Après chaque `git push` depuis votre PC :

```bash
ssh root@191.215.44.82
cd /var/www/SM-TRAVELLET-solution
sudo bash deploy/new-vps/update.sh
```

> Les services de l'application sont dans le profil Docker « production ». Un simple `docker compose up -d --build` **sans** `--profile production` ne reconstruit que PostgreSQL : c'est pourquoi `update.sh` ajoute toujours ce profil.

## Retour arrière

L'ancien serveur n'a pas été modifié : remettez les deux enregistrements A sur `187.127.94.149` (TTL 300). Le site redevient celui d'avant en quelques minutes. Les données saisies sur le nouveau serveur entre-temps ne sont alors pas reprises.

## Sécurité

- Après la migration, changez les mots de passe `root` des deux serveurs, et préférez une clé SSH (`ssh-copy-id`) avec `PasswordAuthentication no`.
- PostgreSQL n'écoute que sur `127.0.0.1` ; seuls les ports 22, 80 et 443 sont ouverts.
- Ne servez jamais le dossier du projet avec nginx : il contient `backend/.env`. Seule la vitrine est publiée (`/var/www/smtravel-vitrine`).
- Sauvegarde régulière conseillée : `docker exec sm-travel-postgres pg_dump -U postgres -d sm_travel -Fc > sauvegarde.dump` (cron hebdomadaire) et copie de `/app/uploads`.
