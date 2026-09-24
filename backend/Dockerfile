# Image de production pour l'API backend (Node/Express + PostgreSQL).
# Build depuis la racine du dossier backend/ (voir docker-compose.yml : context: ./backend).
FROM node:20-alpine

# postgresql-client fournit pg_dump/pg_restore, utilisés par les scripts de
# sauvegarde (backend/scripts/) si on veut les lancer depuis ce conteneur.
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Créés au démarrage si absents ; montés en volume par docker-compose pour
# survivre aux redéploiements (voir la note dans docker-compose.yml).
RUN mkdir -p uploads logs

EXPOSE 3001

CMD ["node", "server.js"]
