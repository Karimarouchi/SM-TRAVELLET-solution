#!/usr/bin/env bash
# Étape 3 — certificat HTTPS gratuit (Let's Encrypt) pour www.smtravel.fr et
# smtravel.fr, puis bascule de nginx en HTTPS avec redirection vers www.
#
# À lancer APRÈS avoir changé le DNS (les deux enregistrements A doivent
# pointer vers CE serveur) :
#   sudo bash deploy/new-vps/03-ssl.sh votre@email.com
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Relancez en root : sudo bash deploy/new-vps/03-ssl.sh votre@email.com"
  exit 1
fi

EMAIL="${1:-}"
if [[ -z "${EMAIL}" ]]; then
  echo "Indiquez une adresse e-mail (alertes d'expiration Let's Encrypt) :"
  echo "  sudo bash deploy/new-vps/03-ssl.sh votre@email.com"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

mkdir -p /var/www/certbot
nginx -t && systemctl reload nginx

echo "==> Demande du certificat"
certbot certonly --webroot -w /var/www/certbot \
  -d www.smtravel.fr -d smtravel.fr \
  --non-interactive --agree-tos -m "${EMAIL}" \
  --deploy-hook "systemctl reload nginx"

echo "==> nginx en HTTPS"
install -m 0644 "${SCRIPT_DIR}/nginx-https.conf" /etc/nginx/sites-available/smtravel
nginx -t
systemctl reload nginx

echo "==> Test du renouvellement automatique"
certbot renew --dry-run

echo
echo "HTTPS actif. Vérifiez :"
echo "  https://www.smtravel.fr/"
echo "  https://www.smtravel.fr/app/#/login"
echo "  https://www.smtravel.fr/api/health"
