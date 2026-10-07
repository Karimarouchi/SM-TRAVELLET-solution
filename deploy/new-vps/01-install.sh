#!/usr/bin/env bash
# Étape 1 — prépare un VPS Ubuntu/Debian vierge : Docker, nginx, certbot,
# pare-feu. À lancer UNE fois, en root, sur le nouveau serveur :
#
#   cd /var/www/SM-TRAVELLET-solution
#   sudo bash deploy/new-vps/01-install.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Relancez en root : sudo bash deploy/new-vps/01-install.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Paquets de base, nginx et certbot"
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw nginx certbot rsync git openssl dnsutils

echo "==> Docker + plugin « docker compose »"
if ! docker compose version >/dev/null 2>&1; then
  # Dépôts de la distribution d'abord (le plus fiable sur une version récente).
  apt-get install -y docker.io docker-compose-v2 || true
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "   (paquets de la distribution indisponibles : installation via get.docker.com)"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
systemctl enable --now nginx
docker compose version

# Compiler l'application (Vite + TypeScript) demande de la mémoire : sur un
# petit serveur sans swap, on en ajoute 2 Go pour éviter un arrêt du build.
MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [[ "${MEM_MB}" -lt 3000 ]] && ! swapon --show | grep -q .; then
  echo "==> Mémoire faible (${MEM_MB} Mo) : création d'un swap de 2 Go"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Pare-feu : SSH + HTTP + HTTPS uniquement"
ufw allow OpenSSH || ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo
echo "Installation terminée."
echo "Suite : copier backend/.env puis lancer  sudo bash deploy/new-vps/02-start-app.sh"
echo "(voir deploy/new-vps/MIGRATION.md)"
if [[ -f /var/run/reboot-required ]]; then
  echo
  echo "Note : le système demande un redémarrage (mises à jour du noyau)."
  echo "Redémarrez quand vous le pouvez : sudo reboot (puis reconnectez-vous en SSH)."
fi
