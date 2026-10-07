#!/usr/bin/env bash
# Étape 2 — configure nginx (HTTP), publie la vitrine, construit et démarre
# l'application (PostgreSQL + API + application React) avec Docker.
#
#   sudo bash deploy/new-vps/02-start-app.sh        # tout démarrer
#   sudo bash deploy/new-vps/02-start-app.sh db     # PostgreSQL seul (avant de restaurer les données)
#
# backend/.env est créé automatiquement s'il n'existe pas (installation neuve) ;
# sinon il est conservé et seules les adresses publiques sont mises à jour.
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

GENERATED_ADMIN_PASSWORD=""
if [[ ! -f backend/.env ]]; then
  echo "==> Création de backend/.env (installation neuve)"
  ADMIN_EMAIL="${ADMIN_EMAIL:-}"
  if [[ -z "${ADMIN_EMAIL}" && -t 0 ]]; then
    read -r -p "E-mail du premier administrateur : " ADMIN_EMAIL
  fi
  if [[ ! "${ADMIN_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    echo "Adresse e-mail administrateur invalide ou absente."
    echo "Relancez avec :  sudo ADMIN_EMAIL=vous@exemple.com bash deploy/new-vps/02-start-app.sh"
    exit 1
  fi
  if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    GENERATED_ADMIN_PASSWORD="$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | cut -c1-16)"
    ADMIN_PASSWORD="${GENERATED_ADMIN_PASSWORD}"
  fi
  cat > backend/.env <<EOF
PORT=3001
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d

# Premier compte administrateur (créé au premier démarrage uniquement)
ADMIN_BOOTSTRAP_EMAIL=${ADMIN_EMAIL}
ADMIN_BOOTSTRAP_PASSWORD=${ADMIN_PASSWORD}

# E-mails : à régler ensuite dans l'application (Paramètres > Envoi d'e-mails).
# WhatsApp, Google Calendar : facultatifs (voir backend/WHATSAPP.md et GOOGLE_CALENDAR.md).
# WHATSAPP_TOKEN=
# WHATSAPP_APP_SECRET=
# WHATSAPP_VERIFY_TOKEN=
# WHATSAPP_PHONE_NUMBER_ID=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
EOF
  chmod 600 backend/.env
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
if [[ -n "${GENERATED_ADMIN_PASSWORD}" ]]; then
  echo
  echo "=== PREMIER ADMINISTRATEUR (notez-le maintenant, il ne sera plus affiché) ==="
  echo "  E-mail       : ${ADMIN_EMAIL}"
  echo "  Mot de passe : ${GENERATED_ADMIN_PASSWORD}"
  echo "  (changez-le après la première connexion)"
fi
echo
echo "Suite : changer le DNS (MIGRATION.md, étape E), puis  sudo bash deploy/new-vps/03-ssl.sh votre@email"
