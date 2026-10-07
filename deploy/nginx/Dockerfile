# Image nginx du site : vitrine statique + routage vers l'API et l'application.
# Construite depuis la RACINE du projet (voir docker-compose.yml, service « nginx »).
FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf && mkdir -p /etc/smtravel /etc/nginx/snippets /var/www/certbot

COPY deploy/nginx/locations.conf /etc/nginx/snippets/smtravel-locations.conf
COPY deploy/nginx/site-http.conf /etc/smtravel/site-http.conf
COPY deploy/nginx/site-https.conf /etc/smtravel/site-https.conf
COPY deploy/nginx/entrypoint.sh /docker-entrypoint.d/40-smtravel.sh
RUN chmod +x /docker-entrypoint.d/40-smtravel.sh

# Site vitrine : uniquement ces fichiers (jamais le dossier du projet entier).
COPY index.html paiement.html tailwind.css robots.txt sitemap.xml /usr/share/nginx/vitrine/
COPY IMAGE /usr/share/nginx/vitrine/IMAGE
COPY js /usr/share/nginx/vitrine/js
COPY css /usr/share/nginx/vitrine/css
COPY SONG /usr/share/nginx/vitrine/SONG
COPY mentions-legales /usr/share/nginx/vitrine/mentions-legales
COPY politique-confidentialite /usr/share/nginx/vitrine/politique-confidentialite
COPY politique-cookies /usr/share/nginx/vitrine/politique-cookies
COPY politique-annulation-remboursement /usr/share/nginx/vitrine/politique-annulation-remboursement
COPY conditions-generales-de-vente /usr/share/nginx/vitrine/conditions-generales-de-vente

EXPOSE 80 443
