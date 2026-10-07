#!/usr/bin/env bash
# Mise à jour du site après un `git push` : récupère le code, republie la
# vitrine, reconstruit et relance l'API et l'application.
#
#   cd /var/www/SM-TRAVELLET-solution
#   sudo bash deploy/new-vps/update.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT_DIR}"

echo "==> Récupération du code"
git pull origin main

echo "==> Vitrine"
bash "${SCRIPT_DIR}/publish-vitrine.sh"

echo "==> Reconstruction (profil production obligatoire)"
docker compose --profile production up -d --build

echo "==> Nettoyage des anciennes images"
docker image prune -f >/dev/null

docker compose --profile production ps
echo
echo "Journaux : docker compose --profile production logs --tail=60 backend"
