#!/usr/bin/env bash
# Étape 2 — configure nginx (HTTP), publie la vitrine, construit et démarre
# l'application (PostgreSQL + API + application React) avec Docker.
#
#   sudo bash deploy/new-vps/02-start-app.sh        # tout démarrer
#   sudo bash deploy/new-vps/02-start-app.sh db     # PostgreSQL seul (avant de restaurer les données)
#
# Prérequis : backend/.env présent (copié depuis l'ancien serveur, voir MIGRATION.md).
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Relancez en root : sudo bash deploy/new-vps/02-start-app.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT_DIR}"

DOMAIN_URL="https://www.smtravel.fr"
MODE="${1:-all}"

if [[ ! -f backend/.env ]]; then
  echo "backend/.env est introuvable."
  echo "Copiez-le depuis l'ancien serveur (voir MIGRATION.md, étape C), puis relancez."
  exit 1
fi
sed -i 's/\r$//' backend/.env

# Fixe (ou ajoute) une variable de backend/.env sans toucher aux autres.
set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" backend/.env; then
    sed -i "s|^${key}=.*|${key}=${value}|" backend/.env
  else
    echo "${key}=${value}" >> backend/.env
  fi
}

echo "==> Adresses publiques de backend/.env -> ${DOMAIN_URL}"
set_env APP_PUBLIC_URL "${DOMAIN_URL}"
set_env CORS_ORIGIN "${DOMAIN_URL}"
set_env GOOGLE_REDIRECT_URI "${DOMAIN_URL}/api/google/callback"
set_env NODE_ENV production

# Fichier .env racine : lu par docker compose (mot de passe PostgreSQL et
# adresse de l'API compilée dans l'application React).
if [[ ! -f .env ]]; then
  echo "==> Création de .env (mot de passe PostgreSQL généré)"
  cat > .env <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=sm_travel
VITE_API_URL=${DOMAIN_URL}
EOF
  chmod 600 .env
else
  sed -i 's/\r$//' .env
  if grep -q '^VITE_API_URL=' .env; then
    sed -i "s|^VITE_API_URL=.*|VITE_API_URL=${DOMAIN_URL}|" .env
  else
    echo "VITE_API_URL=${DOMAIN_URL}" >> .env
  fi
fi

if [[ "${MODE}" == "db" ]]; then
  echo "==> Démarrage de PostgreSQL seul"
  docker compose up -d postgres
  echo "PostgreSQL démarre. Restaurez maintenant les données (MIGRATION.md, étape D),"
  echo "puis relancez sans argument :  sudo bash deploy/new-vps/02-start-app.sh"
  exit 0
fi

echo "==> Vitrine"
bash "${SCRIPT_DIR}/publish-vitrine.sh"

echo "==> nginx (HTTP)"
install -m 0644 "${SCRIPT_DIR}/nginx-locations.conf" /etc/nginx/snippets/smtravel-locations.conf
install -m 0644 "${SCRIPT_DIR}/nginx-http.conf" /etc/nginx/sites-available/smtravel
ln -sf /etc/nginx/sites-available/smtravel /etc/nginx/sites-enabled/smtravel
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/certbot
nginx -t
systemctl reload nginx

echo "==> Construction et démarrage (plusieurs minutes la première fois)"
docker compose --profile production up -d --build

echo "==> Attente de l'API"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3002/api/health >/dev/null 2>&1; then
    echo "API prête."
    break
  fi
  sleep 3
  if [[ "${i}" -eq 40 ]]; then
    echo "L'API ne répond pas. Consultez : docker compose --profile production logs --tail=80 backend"
    exit 1
  fi
done

docker compose --profile production ps
echo
echo "Application démarrée. Vérifications locales :"
echo "  curl -s http://127.0.0.1:3002/api/health"
echo "  curl -sI http://127.0.0.1:8081/app/ | head -1"
echo "  curl -sI http://localhost/ | head -1"
echo
echo "Suite : changer le DNS (MIGRATION.md, étape E), puis  sudo bash deploy/new-vps/03-ssl.sh votre@email"
