# Image de production pour l'API backend (Node/Express + PostgreSQL).
# Build depuis la racine du dossier backend/ (voir docker-compose.yml : context: ./backend).
FROM node:20-alpine

# postgresql16-client fournit pg_dump/pg_restore, utilisés par les scripts de
# sauvegarde (backend/scripts/). Version épinglée sur 16 (au lieu du paquet
# générique "postgresql-client", qui suit la dernière version d'Alpine et a
# fini par installer des outils v18 incompatibles avec notre serveur v16 —
# un dump généré par des outils plus récents peut contenir des réglages que
# la v16 ne reconnaît pas, ex. "transaction_timeout").
RUN apk add --no-cache postgresql16-client

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
