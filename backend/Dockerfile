# Image de production pour l'API backend (Node/Express + PostgreSQL).
# Build depuis la racine du dossier backend/ (voir docker-compose.yml : context: ./backend).
FROM node:20-alpine

# postgresql17-client fournit pg_dump/pg_restore, utilisés par les scripts de
# sauvegarde (backend/scripts/). Version épinglée sur 17, plus récente que
# notre propre serveur (postgres:16) mais nécessaire pour dumper Supabase,
# qui tourne en 17.x — pg_dump refuse de se connecter à un serveur PLUS
# RÉCENT que lui (erreur "server version mismatch"), donc l'outil doit être
# au moins aussi récent que le serveur le plus récent des deux côtés.
# Restaurer un dump v17 dans notre v16 ignore un unique réglage de session
# propre à la v17 ("transaction_timeout") — backupService.js le tolère
# explicitement, ce n'est pas une perte de données.
RUN apk add --no-cache postgresql17-client

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Créés au démarrage si absents ; montés en volume par docker-compose pour
# survivre aux redéploiements (voir la note dans docker-compose.yml).
RUN mkdir -p uploads logs && chown -R node:node /app

# node:20-alpine fournit déjà un utilisateur non privilégié "node" (uid 1000) —
# on l'utilise pour ne jamais exécuter l'API en root dans le conteneur.
USER node

EXPOSE 3001

CMD ["node", "server.js"]
