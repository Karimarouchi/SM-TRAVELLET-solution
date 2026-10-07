#!/usr/bin/env bash
# Installe Docker + la stack SM Travelle sur un Ubuntu/Debian vierge.
# À lancer SUR le VPS, depuis la racine du projet :
#   sudo bash deploy/install-vps.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Relancez en root : sudo bash deploy/install-vps.sh"
  exit 1
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Ce script s'exécute sur le serveur Linux, pas sur Windows."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

export DEBIAN_FRONTEND=noninteractive

echo "==> Mise à jour du système et paquets de base"
apt-get update -y
apt-get install -y ca-certificates curl gnupg openssl ufw

echo "==> Installation de Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker

if [[ ! -f .env ]]; then
  cp .env.example .env
  JWT="$(openssl rand -hex 32)"
  PG_PASS="$(openssl rand -hex 16)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" .env
  echo
  echo "Fichier .env créé. Éditez au minimum :"
  echo "  SITE_ADDRESS, APP_PUBLIC_URL, CORS_ORIGIN"
  echo "  ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD"
  echo "  SMTP_USER, SMTP_PASS (pour les mails d'inscription)"
  echo
  if command -v nano >/dev/null 2>&1; then
    nano .env
  else
    echo "Ouvrez .env avec un éditeur, puis relancez ce script."
    exit 0
  fi
fi

sed -i 's/\r$//' .env || true

# shellcheck disable=SC1091
set -a
# Valeurs avec espaces (SITE_ADDRESS) : on source le fichier
# en ignorant les commentaires.
# shellcheck source=/dev/null
source <(grep -v '^#' .env | sed '/^$/d')
set +a

if [[ -z "${SITE_ADDRESS:-}" ]]; then
  echo "Indiquez SITE_ADDRESS dans .env (votre domaine, ou :80 si vous n'avez que l'IP)."
  exit 1
fi

if [[ -z "${ADMIN_BOOTSTRAP_EMAIL:-}" || "${ADMIN_BOOTSTRAP_EMAIL}" == "admin@example.com" ]]; then
  echo "Indiquez ADMIN_BOOTSTRAP_EMAIL et ADMIN_BOOTSTRAP_PASSWORD dans .env (ce sera le premier admin)."
  exit 1
fi

if [[ -z "${JWT_SECRET:-}" || "${#JWT_SECRET}" -lt 32 ]]; then
  echo "JWT_SECRET trop court. Relancez après avoir généré un secret (openssl rand -hex 32)."
  exit 1
fi

if [[ -z "${POSTGRES_PASSWORD:-}" || "${POSTGRES_PASSWORD}" == "changez-moi" ]]; then
  echo "Changez POSTGRES_PASSWORD dans .env."
  exit 1
fi

echo "==> Pare-feu (SSH + HTTP + HTTPS)"
ufw allow OpenSSH || ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable || true

echo "==> Construction et démarrage (plusieurs minutes la première fois)"
docker compose --profile production up -d --build

echo
echo "Stack démarrée."
echo "  Vitrine     : ${APP_PUBLIC_URL}/"
echo "  Application : ${APP_PUBLIC_URL}/app/#/login"
echo "  Santé API   : ${APP_PUBLIC_URL}/api/health"
echo
echo "Connectez-vous avec ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD."
echo "Les comptes de démo ne sont PAS créés en production."
echo
echo "Logs : docker compose --profile production logs -f"
echo "WhatsApp webhook (Meta) : ${APP_PUBLIC_URL}/api/whatsapp/webhook"
