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

## 3. Tâches planifiées (crontab du serveur de production)

```bash
crontab -e
```

```cron
# Sauvegarde vers Supabase, toutes les 12h
0 */12 * * * cd /chemin/vers/le/projet && node backend/scripts/backup-to-supabase.js >> backend/logs/backup-cron.log 2>&1

# Vérification + alerte, tous les jours à minuit
0 0 * * * cd /chemin/vers/le/projet && node backend/scripts/verify-backup-alert.js >> backend/logs/backup-cron.log 2>&1
```

## 4. Restauration manuelle (en cas de perte de données réelle)

À exécuter vous-même, jamais automatiquement. Cela **écrase le contenu actuel** de la base ciblée — à utiliser uniquement quand la prod a réellement perdu des données et qu'on accepte de revenir à l'état de la dernière sauvegarde.

```bash
# 1. Récupérer un dump depuis Supabase (la sauvegarde)
pg_dump --format=custom --file=restore.dump "$SUPABASE_DATABASE_URL"

# 2. Vérifier le contenu si besoin (optionnel)
pg_restore --list restore.dump | less

# 3. Restaurer dans la base de production
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" restore.dump
```

## 5. Déclenchement manuel depuis l'interface admin

En plus de la tâche planifiée toutes les 12h, un bouton **"Lancer maintenant"** est disponible dans le Dashboard admin (`/admin`), avec le statut de la dernière sauvegarde affiché juste à côté. Utile pour forcer une sauvegarde immédiate avant une opération sensible, ou pour vérifier que tout fonctionne sans attendre le prochain cycle.

## 6. Fichiers

- `backup-to-supabase.js` — exécute la sauvegarde (`pg_dump` prod → `pg_restore` Supabase), écrit le résultat dans `backend/logs/last-backup.json`.
- `verify-backup-alert.js` — lit ce statut, envoie une alerte email (`BACKUP_ALERT_EMAIL`) si la sauvegarde a échoué ou date de plus de 13h.
