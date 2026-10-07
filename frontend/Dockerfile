# Image du site complet servie par nginx : la VITRINE (racine du domaine) et
# l'application connectée React/Vite (sous /app/). Une seule image, un seul
# conteneur : `docker compose up -d --build frontend` met tout le site à jour.
#
# Construite depuis la RACINE du projet (voir docker-compose.yml : context: .),
# car la vitrine (index.html, images…) est à la racine du dépôt.
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# URL de l'API backend à utiliser une fois le site compilé (ex: https://www.smtravel.fr)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
# Site vitrine à la racine : uniquement ces fichiers (jamais le dossier du
# projet entier, qui contient backend/.env — de toute façon exclu par .dockerignore).
COPY index.html paiement.html tailwind.css robots.txt sitemap.xml /usr/share/nginx/html/
COPY IMAGE /usr/share/nginx/html/IMAGE
COPY js /usr/share/nginx/html/js
COPY css /usr/share/nginx/html/css
COPY SONG /usr/share/nginx/html/SONG
COPY mentions-legales /usr/share/nginx/html/mentions-legales
COPY politique-confidentialite /usr/share/nginx/html/politique-confidentialite
COPY politique-cookies /usr/share/nginx/html/politique-cookies
COPY politique-annulation-remboursement /usr/share/nginx/html/politique-annulation-remboursement
COPY conditions-generales-de-vente /usr/share/nginx/html/conditions-generales-de-vente

# Application sous /app/ pour correspondre à base: "/app/" dans vite.config.ts.
COPY --from=build /app/dist /usr/share/nginx/html/app
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
