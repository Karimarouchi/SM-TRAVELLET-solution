#!/usr/bin/env bash
# Obtient le certificat HTTPS (Let's Encrypt) pour www.smtravel.fr et
# smtravel.fr, puis redémarre le conteneur nginx pour passer en HTTPS.
# À lancer APRÈS avoir changé le DNS (les deux enregistrements A doivent
# pointer vers CE serveur), l'application étant déjà démarrée :
#
#   bash deploy/new-vps/ssl.sh votre@email.com
set -euo pipefail

EMAIL="${1:-}"
if [[ -z "${EMAIL}" ]]; then
  echo "Indiquez une adresse e-mail (alertes d'expiration Let's Encrypt) :"
  echo "  bash deploy/new-vps/ssl.sh votre@email.com"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

SERVER_IP="$(curl -4 -fsS https://ifconfig.me || curl -4 -fsS https://api.ipify.org)"
echo "==> Vérification du DNS (ce serveur : ${SERVER_IP})"
ok=1
for host in www.smtravel.fr smtravel.fr; do
  resolved="$(dig +short A "${host}" @1.1.1.1 | tail -1)"
  echo "   ${host} -> ${resolved:-<aucune réponse>}"
  if [[ "${resolved}" != "${SERVER_IP}" ]]; then ok=0; fi
done
if [[ "${ok}" -ne 1 ]]; then
  echo
  echo "Le DNS ne pointe pas encore vers ce serveur (propagation en cours ou"
  echo "enregistrement A non modifié). Attendez quelques minutes, puis relancez."
  exit 1
fi

echo "==> Demande du certificat"
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d www.smtravel.fr -d smtravel.fr \
  --non-interactive --agree-tos --no-eff-email -m "${EMAIL}"

echo "==> Passage en HTTPS"
docker compose restart nginx
sleep 2
docker compose logs --tail=5 nginx

echo
echo "Vérifiez :"
echo "  https://www.smtravel.fr/"
echo "  https://www.smtravel.fr/app/#/login"
echo "  https://www.smtravel.fr/api/health"
echo "Le renouvellement est automatique (conteneur certbot-renew)."
