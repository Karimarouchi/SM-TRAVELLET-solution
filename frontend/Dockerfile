# Image de production pour l'application connectée (React/Vite), servie en
# fichiers statiques par nginx après compilation.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# URL de l'API backend à utiliser une fois le site compilé (ex: https://api.smtravel.fr)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
# Placé sous /app/ pour correspondre au chemin d'URL configuré via
# base: "/app/" dans vite.config.ts — la racine du domaine sert le site
# vitrine statique séparément (voir la config nginx de l'hôte).
COPY --from=build /app/dist /usr/share/nginx/html/app
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
