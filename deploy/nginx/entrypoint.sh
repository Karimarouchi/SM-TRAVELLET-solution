#!/bin/sh
# Lancé automatiquement par l'image nginx au démarrage du conteneur.
#  - pas de certificat -> site en HTTP (site-http.conf)
#  - certificat présent -> site en HTTPS (site-https.conf)
# Un simple « docker compose restart nginx » après l'obtention du certificat
# suffit donc à passer en HTTPS.
set -e

CERT=/etc/letsencrypt/live/www.smtravel.fr/fullchain.pem

if [ -f "$CERT" ]; then
  cp /etc/smtravel/site-https.conf /etc/nginx/conf.d/default.conf
  echo "smtravel: certificat trouvé, site servi en HTTPS"
else
  cp /etc/smtravel/site-http.conf /etc/nginx/conf.d/default.conf
  echo "smtravel: pas de certificat, site servi en HTTP (voir deploy/new-vps/README.md pour le HTTPS)"
fi

# Recharge nginx toutes les 6 h pour prendre en compte un certificat renouvelé.
( while :; do sleep 6h; nginx -s reload >/dev/null 2>&1 || true; done ) >/dev/null 2>&1 &
