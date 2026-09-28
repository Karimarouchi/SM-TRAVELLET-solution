# Sauvegarde vers Supabase

Sauvegarde à **sens unique** : la base de production envoie ses données vers Supabase toutes les 12h. Une vérification quotidienne à minuit alerte par email si une sauvegarde a échoué ou est en retard.

**Important : rien n'est jamais restauré automatiquement dans la production.** Une divergence entre la prod et Supabase est normale (la prod continue de recevoir des écritures entre deux sauvegardes) — restaurer automatiquement dès qu'une différence est détectée effacerait des données valides. La restauration est toujours une action manuelle et volontaire, réservée à une vraie perte de données.

## 1. Prérequis

- Un projet Supabase créé, avec sa chaîne de connexion Postgres (Project Settings → Database → Connection string).
- Les outils client PostgreSQL installés sur le serveur de prod : `pg_dump` et `pg_restore` (paquet `postgresql-client` sous Debian/Ubuntu — déjà présents si PostgreSQL est installé sur la machine).

## 2. Configuration (`backend/.env`)

```
SUPABASE_DATABASE_URL=postgresql://postgres:MOT_DE_PASSE@db.xxxxxxxxxxxx.supabase.co:5432/postgres
BACKUP_ALERT_EMAIL=admin@smtravel.fr
```

Tant que `SUPABASE_DATABASE_URL` n'est pas défini, l'application démarre normalement — seuls les scripts de sauvegarde en ont besoin.

**En local uniquement** (typiquement sur Windows, où `pg_dump`/`pg_restore` ne sont pas dans le PATH par défaut) : si le bouton "Lancer maintenant" ou le script échoue avec `spawn pg_dump ENOENT`, ajoutez le chemin exact des binaires :

```
PG_DUMP_PATH=C:\Program Files\PostgreSQL\16\bin\pg_dump.exe
PG_RESTORE_PATH=C:\Program Files\PostgreSQL\16\bin\pg_restore.exe
```

Ne rien mettre ici en production : l'image Docker du backend a déjà `pg_dump`/`pg_restore` dans son PATH.

## 3. Sauvegarde automatique (aucune crontab à installer)

Le backend planifie lui-même la sauvegarde, **en production uniquement**
(`NODE_ENV=production`, déjà le cas dans `docker-compose.yml`) : toutes les
30 minutes il vérifie la date de la dernière sauvegarde (`logs/last-backup.json`,
conservé entre les redéploiements) et en lance une si elle date de plus de
12 h — ou 1 h après un échec.

En cas d'échec, les admins reçoivent une notification (cloche) et, si
`BACKUP_ALERT_EMAIL` est défini, un email — au plus une alerte toutes les 12 h.

En local (développement), rien ne se lance automatiquement : une base de test
ne doit jamais écraser la vraie sauvegarde. Les scripts restent utilisables à
la main :

```bash
docker exec sm-travel-backend node scripts/backup-to-supabase.js
docker exec sm-travel-backend node scripts/verify-backup-alert.js
```

## 4. Restauration manuelle (en cas de perte de données réelle)

À exécuter vous-même, jamais automatiquement. Cela **écrase le contenu actuel** de la base ciblée — à utiliser uniquement quand la prod a réellement perdu des données et qu'on accepte de revenir à l'état de la dernière sauvegarde.

```bash
# 1. Récupérer un dump depuis Supabase (la sauvegarde)
# --schema=public est essentiel : sans lui, pg_dump embarque aussi les
# schémas internes de Supabase (auth, storage, realtime...), qui n'ont
# rien à voir avec l'app et font échouer la restauration (erreurs
# "must be owner of...").
pg_dump --format=custom --schema=public --file=restore.dump "$SUPABASE_DATABASE_URL"

# 2. Vérifier le contenu si besoin (optionnel)
pg_restore --list restore.dump | less

# 3. Restaurer dans la base de production
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" restore.dump
```

## 5. Déclenchement manuel depuis l'interface admin

En plus de la sauvegarde automatique toutes les 12h, un bouton **"Lancer maintenant"** est disponible dans Paramètres (`/admin/settings`), avec le statut de la dernière sauvegarde affiché juste à côté. Utile pour forcer une sauvegarde immédiate avant une opération sensible, ou pour vérifier que tout fonctionne sans attendre le prochain cycle.

## 6. Fichiers

- `backup-to-supabase.js` — exécute la sauvegarde (`pg_dump` prod → `pg_restore` Supabase), écrit le résultat dans `backend/logs/last-backup.json`.
- `verify-backup-alert.js` — lit ce statut, envoie une alerte email (`BACKUP_ALERT_EMAIL`) si la sauvegarde a échoué ou date de plus de 13h.
