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
RUN apk add --no-cache postgresql17-client su-exec

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Le volume Docker masque ce dossier au démarrage : l'entrée le recrée
# et le donne à l'utilisateur node, sinon la signature ne peut pas être enregistrée.
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
