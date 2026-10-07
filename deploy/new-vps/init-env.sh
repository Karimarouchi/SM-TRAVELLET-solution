#!/usr/bin/env bash
# Crée les deux fichiers de configuration d'une installation neuve (ils ne sont
# pas dans git, car ils contiennent des secrets) :
#
#   .env          -> lu par docker compose (mot de passe PostgreSQL, adresse de l'API)
#   backend/.env  -> secrets de l'API (clé JWT, premier administrateur…)
#
# Ne remplace JAMAIS un fichier existant. À lancer une seule fois :
#   sudo ADMIN_EMAIL=votre@email.com bash deploy/new-vps/init-env.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

DOMAIN_URL="https://www.smtravel.fr"
GENERATED_ADMIN_PASSWORD=""

if [[ ! -f .env ]]; then
  cat > .env <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=sm_travel
VITE_API_URL=${DOMAIN_URL}
EOF
  chmod 600 .env
  echo ".env créé (mot de passe PostgreSQL généré)."
else
  echo ".env existe déjà : conservé."
fi

if [[ ! -f backend/.env ]]; then
  ADMIN_EMAIL="${ADMIN_EMAIL:-}"
  if [[ -z "${ADMIN_EMAIL}" && -t 0 ]]; then
    read -r -p "E-mail du premier administrateur : " ADMIN_EMAIL
  fi
  if [[ ! "${ADMIN_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    echo "Adresse e-mail administrateur invalide ou absente."
    echo "Relancez avec :  sudo ADMIN_EMAIL=vous@exemple.com bash deploy/new-vps/init-env.sh"
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

# Adresse publique du site
APP_PUBLIC_URL=${DOMAIN_URL}
CORS_ORIGIN=${DOMAIN_URL}

# Premier compte administrateur (créé au premier démarrage uniquement)
ADMIN_BOOTSTRAP_EMAIL=${ADMIN_EMAIL}
ADMIN_BOOTSTRAP_PASSWORD=${ADMIN_PASSWORD}

# E-mails : à régler ensuite dans l'application (Paramètres > Envoi d'e-mails).
# WhatsApp et Google Calendar : facultatifs (voir backend/WHATSAPP.md et GOOGLE_CALENDAR.md).
# WHATSAPP_TOKEN=
# WHATSAPP_APP_SECRET=
# WHATSAPP_VERIFY_TOKEN=
# WHATSAPP_PHONE_NUMBER_ID=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
EOF
  chmod 600 backend/.env
  echo "backend/.env créé."
else
  echo "backend/.env existe déjà : conservé."
fi

if [[ -n "${GENERATED_ADMIN_PASSWORD}" ]]; then
  echo
  echo "=== PREMIER ADMINISTRATEUR (notez-le maintenant, il ne sera plus affiché) ==="
  echo "  E-mail       : ${ADMIN_EMAIL}"
  echo "  Mot de passe : ${GENERATED_ADMIN_PASSWORD}"
  echo "  (changez-le après la première connexion)"
fi

echo
echo "Suite :  docker compose --profile production up -d --build"
