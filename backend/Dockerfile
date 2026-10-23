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
# python3 lit les bulletins de paie. Le script Windows utilise la
# reconnaissance de Windows ; sur ce Linux, poppler transforme le PDF en
# image et tesseract (français) lit le texte. py3-pillow est exigé par
# pytesseract. Le lien « python » évite l'échec quand l'API cherche ce nom.
RUN apk add --no-cache \
    postgresql17-client \
    su-exec \
    python3 \
    py3-pip \
    py3-pillow \
    tesseract-ocr \
    tesseract-ocr-data-fra \
    poppler-utils \
  && pip3 install --break-system-packages --no-cache-dir pytesseract pypdf \
  && ln -sf /usr/bin/python3 /usr/bin/python

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
